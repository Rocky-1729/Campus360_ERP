import { getClient, query } from '../../config/database';
import { importStagingService } from './importStaging.service';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { parseSemesterNumber } from './examinationResultParser';
export { parseSemesterNumber };

export interface StudentMasterImportContext {
  batchId?: number;
  sectionId?: number;
}

export interface ExamResultImportContext {
  examinationId: number;
}

export const excelImportService = {
  /**
   * Transactional import of student master records into PostgreSQL.
   */
  importStudentMaster: async (
    token: string,
    context?: StudentMasterImportContext
  ) => {
    const staged = importStagingService.consume(token);
    if (!staged || staged.fileType !== 'STUDENT_MASTER' || !staged.studentData) {
      throw ApiError.badRequest('IMPORT_CONTEXT_EXPIRED: Staged import session expired or invalid. Please preview the file again.');
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Verify academic batch if provided
      let validBatchId: number | null = null;
      if (context?.batchId) {
        const batchRes = await client.query('SELECT id FROM academic_batches WHERE id = $1', [context.batchId]);
        if (batchRes.rows.length === 0) {
          throw ApiError.badRequest(`ACADEMIC_CONTEXT_INVALID: Academic batch with ID ${context.batchId} does not exist`);
        }
        validBatchId = context.batchId;
      }

      // Verify section if provided
      let validSectionId: number | null = null;
      if (context?.sectionId) {
        const secRes = await client.query('SELECT id FROM sections WHERE id = $1', [context.sectionId]);
        if (secRes.rows.length === 0) {
          throw ApiError.badRequest(`ACADEMIC_CONTEXT_INVALID: Section with ID ${context.sectionId} does not exist`);
        }
        validSectionId = context.sectionId;
      }

      let insertedCount = 0;
      let skippedCount = 0;
      let enrolledCount = 0;
      const skippedDetails: Array<{ hallTicket: string; reason: string }> = [];

      for (const student of staged.studentData.allValidStudents) {
        // Check if student already exists
        const existingRes = await client.query<{ id: string }>(
          'SELECT id FROM students WHERE UPPER(hall_ticket_number) = UPPER($1)',
          [student.hallTicketNumber]
        );

        let studentId: string | null = null;

        if (existingRes.rows.length > 0) {
          skippedCount++;
          studentId = existingRes.rows[0].id;
          skippedDetails.push({
            hallTicket: student.hallTicketNumber,
            reason: 'Student record already exists in database (skipped duplicate)',
          });
        } else {
          // Insert new student
          const insertRes = await client.query<{ id: string }>(
            `INSERT INTO students (
              hall_ticket_number, full_name, gender, date_of_birth, email, phone_number
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id::text AS id`,
            [
              student.hallTicketNumber,
              student.fullName,
              student.gender,
              student.dateOfBirth,
              student.email,
              student.phoneNumber,
            ]
          );
          studentId = insertRes.rows[0].id;
          insertedCount++;
        }

        // Create enrollment if batch is resolved and student was newly inserted
        if (validBatchId && studentId && existingRes.rows.length === 0) {
          await client.query(
            `INSERT INTO student_academic_enrollments (
              student_id, academic_batch_id, section_id, enrollment_status
            ) VALUES ($1, $2, $3, 'ACTIVE')`,
            [studentId, validBatchId, validSectionId]
          );
          enrolledCount++;
        }
      }

      // Record audit in excel_uploads
      await client.query(
        `INSERT INTO excel_uploads (
          file_name, file_hash, upload_status, total_rows, successful_rows, failed_rows, error_message
        ) VALUES ($1, $2, 'COMPLETED', $3, $4, $5, $6)`,
        [
          staged.fileName,
          staged.fileHash,
          staged.studentData.summary.totalRows,
          insertedCount,
          skippedCount + staged.studentData.summary.invalidRows,
          skippedDetails.length > 0 ? JSON.stringify(skippedDetails.slice(0, 10)) : null,
        ]
      );

      await client.query('COMMIT');

      return {
        fileName: staged.fileName,
        totalRowsProcessed: staged.studentData.summary.totalRows,
        insertedStudents: insertedCount,
        skippedStudents: skippedCount,
        enrolledStudents: enrolledCount,
        invalidRowsInExcel: staged.studentData.summary.invalidRows,
        duplicateRowsInExcel: staged.studentData.summary.duplicateRows,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to import student master spreadsheet:', error);
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('DATABASE_IMPORT_FAILED: Transaction failed while importing student records.');
    } finally {
      client.release();
    }
  },

  /**
   * Transactional import of wide-format examination results into normalized PostgreSQL tables.
   */
  importExaminationResults: async (
    token: string,
    context: ExamResultImportContext
  ) => {
    const staged = importStagingService.consume(token);
    if (!staged || staged.fileType !== 'EXAMINATION_RESULT' || !staged.examData) {
      throw ApiError.badRequest('IMPORT_CONTEXT_EXPIRED: Staged import session expired or invalid. Please preview the file again.');
    }

    if (!context.examinationId || isNaN(Number(context.examinationId))) {
      throw ApiError.badRequest('EXAMINATION_CONTEXT_MISSING: A valid examinationId is required to import examination results');
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Verify examination existence along with semester context
      const examRes = await client.query<{
        id: string;
        academic_session_id: string;
        semester_id: string;
        semester_number: number;
        semester_name: string;
        exam_name: string;
        exam_type: string;
      }>(`
        SELECT 
          e.id, 
          e.academic_session_id, 
          e.semester_id, 
          sem.semester_number, 
          sem.semester_name,
          e.exam_name, 
          e.exam_type 
        FROM examinations e
        JOIN semesters sem ON e.semester_id = sem.id
        WHERE e.id = $1
      `, [context.examinationId]);

      if (examRes.rows.length === 0) {
        throw ApiError.badRequest(`EXAMINATION_NOT_FOUND: Examination with ID ${context.examinationId} does not exist in database`);
      }

      const exam = examRes.rows[0];

      // Strict Semester Validation: block import if spreadsheet semester conflicts with target examination
      const detectedSemesterStr = staged.examData.metadata?.semester;
      const detectedSemesterNumber = parseSemesterNumber(detectedSemesterStr);

      if (detectedSemesterNumber !== null && detectedSemesterNumber !== exam.semester_number) {
        throw ApiError.badRequest(
          `SEMESTER_MISMATCH: Uploaded spreadsheet contains results for Semester ${detectedSemesterNumber} (${detectedSemesterStr}), but target examination "${exam.exam_name}" is configured for Semester ${exam.semester_number} (${exam.semester_name}). Import blocked.`
        );
      }

      // Duplicate import check
      const duplicateRes = await client.query(
        'SELECT id FROM excel_uploads WHERE file_hash = $1 AND examination_id = $2 AND upload_status = $3',
        [staged.fileHash, context.examinationId, 'COMPLETED']
      );

      if (duplicateRes.rows.length > 0) {
        throw ApiError.conflict('DUPLICATE_IMPORT: This exact examination result file has already been imported for this examination');
      }

      // Pre-load student cache
      const allStudentsRes = await client.query<{ id: string; hall_ticket_number: string }>(
        'SELECT id, hall_ticket_number FROM students'
      );
      const studentMap = new Map<string, string>();
      allStudentsRes.rows.forEach(s => studentMap.set(s.hall_ticket_number.trim().toUpperCase(), s.id));

      // Ensure all detected subjects exist in the PostgreSQL subjects table
      if (staged.examData.detectedSubjects && staged.examData.detectedSubjects.length > 0) {
        for (const subj of staged.examData.detectedSubjects) {
          const rawCode = subj.subjectCode.trim();
          const parts = rawCode.split('-');
          const code = parts[0].trim();
          const name = subj.subjectName || (parts.length > 1 ? parts.slice(1).join('-').trim() : code);

          // Upsert subject using base code
          await client.query(
            `INSERT INTO subjects (subject_code, subject_name)
             VALUES ($1, $2)
             ON CONFLICT (subject_code) DO NOTHING`,
            [code, name]
          );

          // If raw code is different from base code (e.g. 23CS401PC-DM), also upsert raw code
          if (rawCode.toUpperCase() !== code.toUpperCase()) {
            await client.query(
              `INSERT INTO subjects (subject_code, subject_name)
               VALUES ($1, $2)
               ON CONFLICT (subject_code) DO NOTHING`,
              [rawCode, name]
            );
          }
        }
      }

      // Pre-load subjects cache (both full code and base code mapped)
      const allSubjectsRes = await client.query<{ id: string; subject_code: string }>(
        'SELECT id, subject_code FROM subjects'
      );
      const subjectMap = new Map<string, string>();
      allSubjectsRes.rows.forEach(s => {
        const upCode = s.subject_code.trim().toUpperCase();
        subjectMap.set(upCode, s.id);
        if (upCode.includes('-')) {
          const base = upCode.split('-')[0].trim();
          if (!subjectMap.has(base)) subjectMap.set(base, s.id);
        }
      });

      let studentsProcessed = 0;
      let resultsInserted = 0;
      let resultsSkipped = 0;
      let semesterSummariesInserted = 0;
      const studentsNotFound = new Set<string>();
      const subjectsNotFound = new Set<string>();

      for (const row of staged.examData.allValidResults) {
        const ht = row.hallTicketNumber ? row.hallTicketNumber.trim().toUpperCase() : '';
        const studentId = studentMap.get(ht);
        if (!studentId) {
          studentsNotFound.add(row.hallTicketNumber);
          continue;
        }

        // Insert normalized subject scores
        for (const score of row.subjects) {
          const scoreCodeUpper = score.subjectCode.trim().toUpperCase();
          let subjectId = subjectMap.get(scoreCodeUpper);
          if (!subjectId && scoreCodeUpper.includes('-')) {
            subjectId = subjectMap.get(scoreCodeUpper.split('-')[0].trim());
          }

          if (!subjectId) {
            subjectsNotFound.add(score.subjectCode);
            continue;
          }

          // Duplicate check using natural unique constraint (student_id, subject_id, examination_id)
          const dupRes = await client.query(
            'SELECT id FROM exam_results WHERE student_id = $1 AND subject_id = $2 AND examination_id = $3',
            [studentId, subjectId, context.examinationId]
          );

          if (dupRes.rows.length > 0) {
            resultsSkipped++;
            continue;
          }

          // Determine attempt number for this student & subject (handles regular and supplementary attempts)
          const attemptCountRes = await client.query<{ count: string }>(
            'SELECT COUNT(*) FROM exam_results WHERE student_id = $1 AND subject_id = $2',
            [studentId, subjectId]
          );
          const attemptNumber = Number(attemptCountRes.rows[0]?.count || 0) + 1;

          await client.query(
            `INSERT INTO exam_results (
              student_id, subject_id, examination_id, internal_marks, external_marks, total_marks, grade, result_status, attempt_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              studentId,
              subjectId,
              context.examinationId,
              score.internalMarks,
              score.externalMarks,
              score.totalMarks,
              score.grade,
              score.resultStatus,
              attemptNumber,
            ]
          );
          resultsInserted++;
        }

        // Insert semester summary if summary details available
        if (row.semesterSummary && (row.semesterSummary.sgpa !== null || row.semesterSummary.overallResult !== null)) {
          const dupSemRes = await client.query(
            'SELECT id FROM student_semester_results WHERE student_id = $1 AND semester_id = $2 AND examination_id = $3',
            [studentId, exam.semester_id, context.examinationId]
          );

          if (dupSemRes.rows.length === 0) {
            await client.query(
              `INSERT INTO student_semester_results (
                student_id, academic_session_id, semester_id, examination_id, sgpa, cgpa, total_credits, earned_credits, overall_result
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                studentId,
                exam.academic_session_id,
                exam.semester_id,
                context.examinationId,
                row.semesterSummary.sgpa,
                row.semesterSummary.cgpa,
                row.semesterSummary.totalCredits,
                row.semesterSummary.earnedCredits,
                row.semesterSummary.overallResult,
              ]
            );
            semesterSummariesInserted++;
          }
        }

        studentsProcessed++;
      }

      // Record audit in excel_uploads
      await client.query(
        `INSERT INTO excel_uploads (
          file_name, file_hash, examination_id, upload_status, total_rows, successful_rows, failed_rows, error_message
        ) VALUES ($1, $2, $3, 'COMPLETED', $4, $5, $6, $7)`,
        [
          staged.fileName,
          staged.fileHash,
          context.examinationId,
          staged.examData.summary.totalStudents,
          studentsProcessed,
          studentsNotFound.size + staged.examData.summary.invalidStudents,
          studentsNotFound.size > 0
            ? JSON.stringify({ studentsNotFound: Array.from(studentsNotFound).slice(0, 20) })
            : null,
        ]
      );

      await client.query('COMMIT');

      return {
        fileName: staged.fileName,
        examinationId: context.examinationId,
        examinationName: exam.exam_name,
        totalStudentsInExcel: staged.examData.summary.totalStudents,
        studentsProcessed,
        resultsInserted,
        resultsSkipped,
        semesterSummariesInserted,
        studentsNotFound: Array.from(studentsNotFound),
        subjectsNotFound: Array.from(subjectsNotFound),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to import examination results spreadsheet:', error);
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('DATABASE_IMPORT_FAILED: Transaction failed while importing examination results.');
    } finally {
      client.release();
    }
  },

  /**
   * Retrieves upload audit history.
   */
  getUploadHistory: async () => {
    const res = await query(`
      SELECT 
        u.id::text AS id,
        u.file_name AS "fileName",
        u.file_hash AS "fileHash",
        u.examination_id::text AS "examinationId",
        e.exam_name AS "examinationName",
        e.exam_type AS "examType",
        sem.semester_number AS "semesterNumber",
        sem.semester_name AS "semesterName",
        u.upload_status AS "uploadStatus",
        u.total_rows AS "totalRows",
        u.successful_rows AS "successfulRows",
        u.failed_rows AS "failedRows",
        u.error_message AS "errorMessage",
        u.uploaded_at::text AS "uploadedAt"
      FROM excel_uploads u
      LEFT JOIN examinations e ON u.examination_id = e.id
      LEFT JOIN semesters sem ON e.semester_id = sem.id
      ORDER BY u.uploaded_at DESC
      LIMIT 50
    `);
    return res.rows;
  },
};
