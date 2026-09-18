import { query } from '../config/database';
import {
  IStudentListItem,
  IStudentProfileDetails,
  IStudentListFilters,
} from '../interfaces/db.interface';

export const pgStudentRepository = {
  /**
   * Fetches paginated student list joined with academic enrollment hierarchy.
   */
  findStudents: async (
    filters: IStudentListFilters
  ): Promise<{ students: IStudentListItem[]; total: number; page: number; limit: number; totalPages: number }> => {
    const conditions: string[] = [];
    const countParams: any[] = [];
    let idx = 1;

    if (filters.search && filters.search.trim()) {
      countParams.push(`%${filters.search.trim()}%`);
      conditions.push(`(s.full_name ILIKE $${idx} OR s.hall_ticket_number ILIKE $${idx})`);
      idx++;
    }

    if (filters.departmentId) {
      countParams.push(filters.departmentId);
      conditions.push(`d.id = $${idx}::bigint`);
      idx++;
    }

    if (filters.programId) {
      countParams.push(filters.programId);
      conditions.push(`p.id = $${idx}::bigint`);
      idx++;
    }

    if (filters.batchId) {
      countParams.push(filters.batchId);
      conditions.push(`b.id = $${idx}::bigint`);
      idx++;
    }

    if (filters.sectionId) {
      countParams.push(filters.sectionId);
      conditions.push(`sec.id = $${idx}::bigint`);
      idx++;
    }

    if (filters.status && filters.status.trim()) {
      countParams.push(filters.status.trim().toUpperCase());
      conditions.push(`UPPER(sae.enrollment_status) = $${idx}`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count query
    const countSql = `
      SELECT COUNT(DISTINCT s.id) AS total
      FROM students s
      LEFT JOIN student_academic_enrollments sae ON sae.student_id = s.id
      LEFT JOIN academic_batches b ON sae.academic_batch_id = b.id
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN sections sec ON sae.section_id = sec.id
      ${whereClause}
    `;

    const countRes = await query<{ total: string }>(countSql, countParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const offset = (page - 1) * limit;

    // Data query with pagination
    const dataParams = [...countParams, limit, offset];
    const limitIdx = idx++;
    const offsetIdx = idx++;

    const dataSql = `
      SELECT 
        s.id::text AS id,
        s.hall_ticket_number AS "hallTicketNumber",
        s.full_name AS "name",
        s.email,
        s.phone_number AS "phoneNumber",
        s.gender,
        s.date_of_birth::text AS "dateOfBirth",
        d.id::text AS "departmentId",
        d.department_code AS "departmentCode",
        d.department_name AS "departmentName",
        p.id::text AS "programId",
        p.program_code AS "programCode",
        p.program_name AS "programName",
        b.id::text AS "batchId",
        b.batch_name AS "batchName",
        sec.id::text AS "sectionId",
        sec.section_name AS "sectionName",
        sae.enrollment_status AS "enrollmentStatus",
        sae.joined_date::text AS "joinedDate"
      FROM students s
      LEFT JOIN student_academic_enrollments sae ON sae.student_id = s.id
      LEFT JOIN academic_batches b ON sae.academic_batch_id = b.id
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN sections sec ON sae.section_id = sec.id
      ${whereClause}
      ORDER BY s.id ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const dataRes = await query<IStudentListItem>(dataSql, dataParams);

    return {
      students: dataRes.rows,
      total,
      page,
      limit,
      totalPages,
    };
  },

  /**
   * Retrieves single student profile with full enrollment and academic information.
   * Identifier can be student ID or hall ticket number.
   */
  findStudentById: async (identifier: string): Promise<IStudentProfileDetails | null> => {
    const sql = `
      SELECT 
        s.id::text AS id,
        s.hall_ticket_number AS "hallTicketNumber",
        s.full_name AS "name",
        s.gender,
        s.date_of_birth::text AS "dateOfBirth",
        s.email,
        s.phone_number AS "phoneNumber",
        s.created_at::text AS "createdAt",
        s.updated_at::text AS "updatedAt",
        d.id::text AS "departmentId",
        d.department_code AS "departmentCode",
        d.department_name AS "departmentName",
        p.id::text AS "programId",
        p.program_code AS "programCode",
        p.program_name AS "programName",
        p.degree,
        p.duration_years AS "durationYears",
        b.id::text AS "batchId",
        b.batch_name AS "batchName",
        b.start_year AS "batchStartYear",
        b.expected_completion_year AS "batchExpectedCompletionYear",
        sec.id::text AS "sectionId",
        sec.section_name AS "sectionName",
        sae.enrollment_status AS "enrollmentStatus",
        sae.joined_date::text AS "joinedDate"
      FROM students s
      LEFT JOIN student_academic_enrollments sae ON sae.student_id = s.id
      LEFT JOIN academic_batches b ON sae.academic_batch_id = b.id
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN sections sec ON sae.section_id = sec.id
      WHERE (
        CASE 
          WHEN $1 ~ '^[0-9]+$' THEN s.id = $1::bigint OR UPPER(s.hall_ticket_number) = UPPER($1)
          ELSE UPPER(s.hall_ticket_number) = UPPER($1)
        END
      )
      LIMIT 1
    `;

    const res = await query<IStudentProfileDetails>(sql, [identifier.trim()]);
    return res.rows[0] || null;
  },

  /**
   * Direct count of student records in database.
   */
  getStudentCount: async (): Promise<number> => {
    const res = await query<{ count: string }>('SELECT COUNT(*) AS count FROM students');
    return parseInt(res.rows[0]?.count || '0', 10);
  },

  /**
   * Direct count of academic enrollment records in database.
   */
  getEnrollmentCount: async (): Promise<number> => {
    const res = await query<{ count: string }>('SELECT COUNT(*) AS count FROM student_academic_enrollments');
    return parseInt(res.rows[0]?.count || '0', 10);
  },
};
