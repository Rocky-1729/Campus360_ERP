import { query } from '../config/database';
import {
  ISubjectListItem,
  ICurriculumSubjectView,
  IExaminationView,
} from '../interfaces/db.interface';

export const pgSubjectExamRepository = {
  /**
   * Fetches subjects with optional search and curriculum context filters (semester, batch, program).
   */
  findSubjects: async (filters: {
    search?: string;
    semesterId?: number;
    programId?: number;
    batchId?: number;
  }): Promise<ISubjectListItem[]> => {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    // Search by subject code or subject name
    if (filters.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      conditions.push(`(s.subject_code ILIKE $${idx} OR s.subject_name ILIKE $${idx})`);
      idx++;
    }

    // Filter by semester via curriculum_subjects
    if (filters.semesterId) {
      params.push(filters.semesterId);
      conditions.push(`cs.semester_id = $${idx}::bigint`);
      idx++;
    }

    // Filter by batch via curriculum_subjects
    if (filters.batchId) {
      params.push(filters.batchId);
      conditions.push(`cs.academic_batch_id = $${idx}::bigint`);
      idx++;
    }

    // Filter by program via curriculum_subjects -> academic_batches
    if (filters.programId) {
      params.push(filters.programId);
      conditions.push(`b.program_id = $${idx}::bigint`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT DISTINCT
        s.id::text AS id,
        s.subject_code AS "subjectCode",
        s.subject_name AS "subjectName",
        s.created_at::text AS "createdAt",
        s.updated_at::text AS "updatedAt"
      FROM subjects s
      LEFT JOIN curriculum_subjects cs ON cs.subject_id = s.id
      LEFT JOIN academic_batches b ON cs.academic_batch_id = b.id
      ${whereClause}
      ORDER BY s.subject_code ASC
    `;

    const res = await query<ISubjectListItem>(sql, params);
    return res.rows;
  },

  /**
   * Fetches curriculum subjects mapping courses to batches and semesters.
   */
  findCurriculumSubjects: async (filters: {
    batchId?: number;
    semesterId?: number;
    programId?: number;
  }): Promise<ICurriculumSubjectView[]> => {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.batchId) {
      params.push(filters.batchId);
      conditions.push(`cs.academic_batch_id = $${idx}::bigint`);
      idx++;
    }

    if (filters.semesterId) {
      params.push(filters.semesterId);
      conditions.push(`cs.semester_id = $${idx}::bigint`);
      idx++;
    }

    if (filters.programId) {
      params.push(filters.programId);
      conditions.push(`b.program_id = $${idx}::bigint`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        cs.id::text AS id,
        cs.academic_batch_id::text AS "batchId",
        b.batch_name AS "batchName",
        p.id::text AS "programId",
        p.program_code AS "programCode",
        p.program_name AS "programName",
        cs.semester_id::text AS "semesterId",
        sem.semester_number AS "semesterNumber",
        sem.semester_name AS "semesterName",
        cs.subject_id::text AS "subjectId",
        s.subject_code AS "subjectCode",
        s.subject_name AS "subjectName",
        cs.maximum_internal_marks AS "maximumInternalMarks",
        cs.maximum_external_marks AS "maximumExternalMarks",
        cs.maximum_total_marks AS "maximumTotalMarks",
        cs.credits,
        cs.created_at::text AS "createdAt",
        cs.updated_at::text AS "updatedAt"
      FROM curriculum_subjects cs
      JOIN subjects s ON cs.subject_id = s.id
      JOIN academic_batches b ON cs.academic_batch_id = b.id
      JOIN programs p ON b.program_id = p.id
      JOIN semesters sem ON cs.semester_id = sem.id
      ${whereClause}
      ORDER BY sem.semester_number ASC, s.subject_code ASC
    `;

    const res = await query<ICurriculumSubjectView>(sql, params);
    return res.rows;
  },

  /**
   * Fetches examinations with session, semester, exam_type, and status filters.
   */
  findExaminations: async (filters: {
    academicSessionId?: number;
    semesterId?: number;
    examinationType?: string;
    status?: string;
  }): Promise<IExaminationView[]> => {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.academicSessionId) {
      params.push(filters.academicSessionId);
      conditions.push(`e.academic_session_id = $${idx}::bigint`);
      idx++;
    }

    if (filters.semesterId) {
      params.push(filters.semesterId);
      conditions.push(`e.semester_id = $${idx}::bigint`);
      idx++;
    }

    if (filters.examinationType && filters.examinationType.trim()) {
      params.push(filters.examinationType.trim().toUpperCase());
      conditions.push(`UPPER(e.exam_type) = $${idx}`);
      idx++;
    }

    if (filters.status && filters.status.trim()) {
      params.push(filters.status.trim().toUpperCase());
      conditions.push(`UPPER(e.status) = $${idx}`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        e.id::text AS id,
        e.academic_session_id::text AS "academicSessionId",
        sess.session_name AS "sessionName",
        e.semester_id::text AS "semesterId",
        sem.semester_number AS "semesterNumber",
        sem.semester_name AS "semesterName",
        e.exam_type AS "examType",
        e.exam_name AS "examName",
        e.exam_date::text AS "examDate",
        e.status,
        e.created_at::text AS "createdAt",
        e.updated_at::text AS "updatedAt"
      FROM examinations e
      JOIN academic_sessions sess ON e.academic_session_id = sess.id
      JOIN semesters sem ON e.semester_id = sem.id
      ${whereClause}
      ORDER BY e.exam_date DESC NULLS LAST, e.id DESC
    `;

    const res = await query<IExaminationView>(sql, params);
    return res.rows;
  },

  /**
   * Creates a new examination record and returns it with joined session and semester metadata.
   */
  createExamination: async (data: {
    academicSessionId: number;
    semesterId: number;
    examType: 'REGULAR' | 'SUPPLEMENTARY';
    examName: string;
    examDate?: string | null;
    status?: string;
  }): Promise<IExaminationView> => {
    const insertSql = `
      INSERT INTO examinations (
        academic_session_id,
        semester_id,
        exam_type,
        exam_name,
        exam_date,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id::text AS id
    `;
    const insertRes = await query<{ id: string }>(insertSql, [
      data.academicSessionId,
      data.semesterId,
      data.examType,
      data.examName,
      data.examDate || null,
      data.status || 'COMPLETED',
    ]);

    const newId = insertRes.rows[0].id;

    // Fetch complete examination with joined details
    const selectSql = `
      SELECT 
        e.id::text AS id,
        e.academic_session_id::text AS "academicSessionId",
        sess.session_name AS "sessionName",
        e.semester_id::text AS "semesterId",
        sem.semester_number AS "semesterNumber",
        sem.semester_name AS "semesterName",
        e.exam_type AS "examType",
        e.exam_name AS "examName",
        e.exam_date::text AS "examDate",
        e.status,
        e.created_at::text AS "createdAt",
        e.updated_at::text AS "updatedAt"
      FROM examinations e
      JOIN academic_sessions sess ON e.academic_session_id = sess.id
      JOIN semesters sem ON e.semester_id = sem.id
      WHERE e.id = $1::bigint
    `;
    const res = await query<IExaminationView>(selectSql, [newId]);
    return res.rows[0];
  },

  /**
   * Checks table counts for reporting.
   */
  getCounts: async (): Promise<{
    subjects: number;
    curriculumSubjects: number;
    examinations: number;
    examResults: number;
    studentSemesterResults: number;
    excelUploads: number;
  }> => {
    const [sub, cs, exam, res, semRes, upl] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) AS count FROM subjects'),
      query<{ count: string }>('SELECT COUNT(*) AS count FROM curriculum_subjects'),
      query<{ count: string }>('SELECT COUNT(*) AS count FROM examinations'),
      query<{ count: string }>('SELECT COUNT(*) AS count FROM exam_results'),
      query<{ count: string }>('SELECT COUNT(*) AS count FROM student_semester_results'),
      query<{ count: string }>('SELECT COUNT(*) AS count FROM excel_uploads'),
    ]);

    return {
      subjects: parseInt(sub.rows[0]?.count || '0', 10),
      curriculumSubjects: parseInt(cs.rows[0]?.count || '0', 10),
      examinations: parseInt(exam.rows[0]?.count || '0', 10),
      examResults: parseInt(res.rows[0]?.count || '0', 10),
      studentSemesterResults: parseInt(semRes.rows[0]?.count || '0', 10),
      excelUploads: parseInt(upl.rows[0]?.count || '0', 10),
    };
  },
};
