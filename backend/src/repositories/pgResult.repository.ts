import { query } from '../config/database';
import { logger } from '../utils/logger';

export interface StudentAcademicInfo {
  id: number;
  hallTicketNumber: string;
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null;
  email: string | null;
  phoneNumber: string | null;
  enrollmentStatus: string | null;
  batchName: string | null;
  startYear: number | null;
  expectedCompletionYear: number | null;
  programCode: string | null;
  programName: string | null;
  degree: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  sectionName: string | null;
}

export interface StudentSubjectResultRow {
  examinationId: number;
  examName: string;
  examType: string;
  examDate: string | null;
  semesterId: number;
  semesterNumber: number;
  yearNumber: number;
  semesterName: string;
  academicSessionId: number;
  sessionName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  internalMarks: number | null;
  externalMarks: number | null;
  totalMarks: number | null;
  grade: string | null;
  resultStatus: string;
  attemptNumber: number;
  credits: number | null;
  maximumInternalMarks: number | null;
  maximumExternalMarks: number | null;
  maximumTotalMarks: number | null;
}

export interface StudentSemesterSummaryRow {
  examinationId: number;
  semesterId: number;
  academicSessionId: number;
  sgpa: number | null;
  cgpa: number | null;
  totalCredits: number | null;
  earnedCredits: number | null;
  overallResult: string | null;
}

export const pgResultRepository = {
  /**
   * Find basic student details with academic hierarchy by hall ticket
   */
  async findStudentByHallTicket(hallTicket: string): Promise<StudentAcademicInfo | null> {
    const sql = `
      SELECT 
        s.id,
        s.hall_ticket_number AS "hallTicketNumber",
        s.full_name AS "fullName",
        s.gender,
        s.date_of_birth AS "dateOfBirth",
        s.email,
        s.phone_number AS "phoneNumber",
        sae.enrollment_status AS "enrollmentStatus",
        ab.batch_name AS "batchName",
        ab.start_year AS "startYear",
        ab.expected_completion_year AS "expectedCompletionYear",
        p.program_code AS "programCode",
        p.program_name AS "programName",
        p.degree,
        d.department_code AS "departmentCode",
        d.department_name AS "departmentName",
        sec.section_name AS "sectionName"
      FROM students s
      LEFT JOIN student_academic_enrollments sae ON s.id = sae.student_id
      LEFT JOIN academic_batches ab ON sae.academic_batch_id = ab.id
      LEFT JOIN programs p ON ab.program_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN sections sec ON sae.section_id = sec.id
      WHERE UPPER(TRIM(s.hall_ticket_number)) = UPPER(TRIM($1))
      LIMIT 1
    `;
    const res = await query<StudentAcademicInfo>(sql, [hallTicket]);
    return res.rows[0] || null;
  },

  /**
   * Get all subject marks for a student across all examinations
   */
  async getStudentSubjectResults(studentId: number): Promise<StudentSubjectResultRow[]> {
    const sql = `
      SELECT 
        e.id AS "examinationId",
        e.exam_name AS "examName",
        e.exam_type AS "examType",
        e.exam_date AS "examDate",
        sem.id AS "semesterId",
        sem.semester_number AS "semesterNumber",
        sem.year_number AS "yearNumber",
        sem.semester_name AS "semesterName",
        sess.id AS "academicSessionId",
        sess.session_name AS "sessionName",
        sub.id AS "subjectId",
        sub.subject_code AS "subjectCode",
        sub.subject_name AS "subjectName",
        er.internal_marks::float AS "internalMarks",
        er.external_marks::float AS "externalMarks",
        er.total_marks::float AS "totalMarks",
        er.grade,
        er.result_status AS "resultStatus",
        er.attempt_number AS "attemptNumber",
        cs.credits::float AS "credits",
        cs.maximum_internal_marks::float AS "maximumInternalMarks",
        cs.maximum_external_marks::float AS "maximumExternalMarks",
        cs.maximum_total_marks::float AS "maximumTotalMarks"
      FROM exam_results er
      JOIN examinations e ON er.examination_id = e.id
      JOIN semesters sem ON e.semester_id = sem.id
      JOIN academic_sessions sess ON e.academic_session_id = sess.id
      JOIN subjects sub ON er.subject_id = sub.id
      LEFT JOIN student_academic_enrollments sae ON er.student_id = sae.student_id
      LEFT JOIN curriculum_subjects cs ON cs.subject_id = sub.id 
        AND cs.semester_id = sem.id 
        AND cs.academic_batch_id = sae.academic_batch_id
      WHERE er.student_id = $1
      ORDER BY sem.semester_number ASC, COALESCE(e.exam_date, e.created_at::date) ASC, sub.subject_code ASC
    `;
    const res = await query<StudentSubjectResultRow>(sql, [studentId]);
    return res.rows;
  },

  /**
   * Get semester summary rows (SGPA, CGPA, overall result) for a student
   */
  async getStudentSemesterSummaries(studentId: number): Promise<StudentSemesterSummaryRow[]> {
    const sql = `
      SELECT 
        ssr.examination_id AS "examinationId",
        ssr.semester_id AS "semesterId",
        ssr.academic_session_id AS "academicSessionId",
        ssr.sgpa::float AS "sgpa",
        ssr.cgpa::float AS "cgpa",
        ssr.total_credits::float AS "totalCredits",
        ssr.earned_credits::float AS "earnedCredits",
        ssr.overall_result AS "overallResult"
      FROM student_semester_results ssr
      WHERE ssr.student_id = $1
      ORDER BY ssr.id ASC
    `;
    const res = await query<StudentSemesterSummaryRow>(sql, [studentId]);
    return res.rows;
  },

  /**
   * Verify an examination exists by ID
   */
  async findExaminationById(examinationId: number): Promise<any | null> {
    const sql = `
      SELECT 
        e.id,
        e.exam_name AS "examName",
        e.exam_type AS "examType",
        e.exam_date AS "examDate",
        e.status,
        sem.id AS "semesterId",
        sem.semester_number AS "semesterNumber",
        sem.semester_name AS "semesterName",
        sess.id AS "academicSessionId",
        sess.session_name AS "sessionName"
      FROM examinations e
      JOIN semesters sem ON e.semester_id = sem.id
      JOIN academic_sessions sess ON e.academic_session_id = sess.id
      WHERE e.id = $1
    `;
    const res = await query(sql, [examinationId]);
    return res.rows[0] || null;
  },

  /**
   * Get paginated student examination results ledger for a specific examination
   */
  async getExaminationStudentLedger(
    examinationId: number,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      sectionId?: number;
      resultStatus?: string;
    }
  ): Promise<{ students: any[]; totalCount: number }> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['ssr.examination_id = $1'];
    const params: any[] = [examinationId];
    let paramIndex = 2;

    if (options.search && options.search.trim()) {
      conditions.push(`(s.hall_ticket_number ILIKE $${paramIndex} OR s.full_name ILIKE $${paramIndex})`);
      params.push(`%${options.search.trim()}%`);
      paramIndex++;
    }

    if (options.sectionId) {
      conditions.push(`sae.section_id = $${paramIndex}`);
      params.push(Number(options.sectionId));
      paramIndex++;
    }

    if (options.resultStatus) {
      conditions.push(`ssr.overall_result = $${paramIndex}`);
      params.push(options.resultStatus.trim().toUpperCase());
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // 1. Total count
    const countSql = `
      SELECT COUNT(DISTINCT s.id) AS count
      FROM student_semester_results ssr
      JOIN students s ON ssr.student_id = s.id
      LEFT JOIN student_academic_enrollments sae ON s.id = sae.student_id
      WHERE ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const totalCount = parseInt(countRes.rows[0]?.count || '0', 10);

    if (totalCount === 0) {
      return { students: [], totalCount: 0 };
    }

    // 2. Fetch paginated student summary rows
    const studentListSql = `
      SELECT 
        s.id AS "studentId",
        s.hall_ticket_number AS "hallTicketNumber",
        s.full_name AS "fullName",
        sec.id AS "sectionId",
        sec.section_name AS "sectionName",
        ssr.sgpa::float AS "sgpa",
        ssr.cgpa::float AS "cgpa",
        ssr.total_credits::float AS "totalCredits",
        ssr.earned_credits::float AS "earnedCredits",
        ssr.overall_result AS "overallResult"
      FROM student_semester_results ssr
      JOIN students s ON ssr.student_id = s.id
      LEFT JOIN student_academic_enrollments sae ON s.id = sae.student_id
      LEFT JOIN sections sec ON sae.section_id = sec.id
      WHERE ${whereClause}
      ORDER BY s.hall_ticket_number ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const studentListParams = [...params, limit, offset];
    const studentListRes = await query(studentListSql, studentListParams);
    const students = studentListRes.rows;

    if (students.length === 0) {
      return { students: [], totalCount };
    }

    // 3. Fetch individual subject results for these students in this examination
    const studentIds = students.map((st: any) => st.studentId);
    const marksSql = `
      SELECT 
        er.student_id AS "studentId",
        sub.id AS "subjectId",
        sub.subject_code AS "subjectCode",
        sub.subject_name AS "subjectName",
        er.internal_marks::float AS "internalMarks",
        er.external_marks::float AS "externalMarks",
        er.total_marks::float AS "totalMarks",
        er.grade,
        er.result_status AS "resultStatus",
        er.attempt_number AS "attemptNumber"
      FROM exam_results er
      JOIN subjects sub ON er.subject_id = sub.id
      WHERE er.examination_id = $1 AND er.student_id = ANY($2::bigint[])
      ORDER BY sub.subject_code ASC
    `;
    const marksRes = await query(marksSql, [examinationId, studentIds]);

    const marksByStudent: Record<number, any[]> = {};
    marksRes.rows.forEach((m: any) => {
      if (!marksByStudent[m.studentId]) {
        marksByStudent[m.studentId] = [];
      }
      marksByStudent[m.studentId].push({
        subjectCode: m.subjectCode,
        subjectName: m.subjectName,
        internalMarks: m.internalMarks,
        externalMarks: m.externalMarks,
        totalMarks: m.totalMarks,
        grade: m.grade,
        resultStatus: m.resultStatus,
        attemptNumber: m.attemptNumber,
      });
    });

    const enrichedStudents = students.map((st: any) => ({
      ...st,
      subjectResults: marksByStudent[st.studentId] || [],
    }));

    return { students: enrichedStudents, totalCount };
  },
};
