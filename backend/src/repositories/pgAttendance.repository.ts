import { query } from '../config/database';

export interface AttendanceSessionRow {
  id: number;
  academic_session_id: number | null;
  semester_id: number | null;
  section_id: number;
  subject_id: number;
  faculty_user_id: number | null;
  session_date: string;
  period_number: number;
  topic_covered: string | null;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecordRow {
  id: number;
  attendance_session_id: number;
  student_id: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export const pgAttendanceRepository = {
  /**
   * Finds an existing attendance session or creates a new one.
   */
  findOrCreateSession: async (params: {
    sectionId: number;
    subjectId: number;
    sessionDate: string;
    periodNumber?: number;
    facultyUserId?: number;
    academicSessionId?: number;
    semesterId?: number;
    topicCovered?: string;
  }): Promise<AttendanceSessionRow> => {
    const period = params.periodNumber || 1;

    // Check existing
    const findRes = await query<AttendanceSessionRow>(
      `SELECT * FROM attendance_sessions 
       WHERE section_id = $1 AND subject_id = $2 AND session_date = $3 AND period_number = $4`,
      [params.sectionId, params.subjectId, params.sessionDate, period]
    );

    if (findRes.rows.length > 0) {
      return findRes.rows[0];
    }

    // Insert new
    const insertRes = await query<AttendanceSessionRow>(
      `INSERT INTO attendance_sessions (
         section_id, subject_id, session_date, period_number,
         faculty_user_id, academic_session_id, semester_id, topic_covered
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.sectionId,
        params.subjectId,
        params.sessionDate,
        period,
        params.facultyUserId || null,
        params.academicSessionId || null,
        params.semesterId || null,
        params.topicCovered || null,
      ]
    );

    return insertRes.rows[0];
  },

  /**
   * Retrieves a session by ID.
   */
  getSessionById: async (sessionId: number): Promise<AttendanceSessionRow | undefined> => {
    const res = await query<AttendanceSessionRow>(
      'SELECT * FROM attendance_sessions WHERE id = $1',
      [sessionId]
    );
    return res.rows[0];
  },

  /**
   * Bulk upserts attendance records for a session.
   */
  upsertRecords: async (
    sessionId: number,
    records: Array<{
      studentId: number;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
      remarks?: string;
    }>
  ): Promise<{ inserted: number; updated: number }> => {
    let inserted = 0;
    let updated = 0;

    for (const r of records) {
      const res = await query(
        `INSERT INTO attendance_records (attendance_session_id, student_id, status, remarks)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (attendance_session_id, student_id)
         DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP
         RETURNING (xmax = 0) AS is_insert;`,
        [sessionId, r.studentId, r.status, r.remarks || null]
      );
      if (res.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    return { inserted, updated };
  },

  /**
   * Returns the student checklist for faculty marking.
   */
  getSectionChecklist: async (
    subjectId: number,
    sectionId: number,
    date: string,
    periodNumber: number = 1
  ): Promise<Array<{
    studentId: number;
    hallTicketNumber: string;
    name: string;
    status: string | null;
    attendanceRecordId: number | null;
    isLocked: boolean;
  }>> => {
    const sql = `
      SELECT 
        s.id AS "studentId",
        s.hall_ticket_number AS "hallTicketNumber",
        s.full_name AS "name",
        LOWER(ar.status) AS "status",
        ar.id AS "attendanceRecordId",
        COALESCE(sess.is_locked, FALSE) AS "isLocked"
      FROM students s
      JOIN student_academic_enrollments sae ON s.id = sae.student_id
      LEFT JOIN attendance_sessions sess ON (
        sess.section_id = $2 
        AND sess.subject_id = $1 
        AND sess.session_date = $3 
        AND sess.period_number = $4
      )
      LEFT JOIN attendance_records ar ON (
        ar.attendance_session_id = sess.id 
        AND ar.student_id = s.id
      )
      WHERE sae.section_id = $2 AND sae.enrollment_status = 'ACTIVE'
      ORDER BY s.hall_ticket_number ASC;
    `;

    const res = await query(sql, [subjectId, sectionId, date, periodNumber]);

    // Fallback: If no enrollments exist in section yet, check all students
    if (res.rows.length === 0) {
      const allStudentsSql = `
        SELECT 
          s.id AS "studentId",
          s.hall_ticket_number AS "hallTicketNumber",
          s.full_name AS "name",
          LOWER(ar.status) AS "status",
          ar.id AS "attendanceRecordId",
          COALESCE(sess.is_locked, FALSE) AS "isLocked"
        FROM students s
        LEFT JOIN attendance_sessions sess ON (
          sess.section_id = $2 
          AND sess.subject_id = $1 
          AND sess.session_date = $3 
          AND sess.period_number = $4
        )
        LEFT JOIN attendance_records ar ON (
          ar.attendance_session_id = sess.id 
          AND ar.student_id = s.id
        )
        ORDER BY s.hall_ticket_number ASC
        LIMIT 100;
      `;
      const fallbackRes = await query(allStudentsSql, [subjectId, sectionId, date, periodNumber]);
      return fallbackRes.rows;
    }

    return res.rows;
  },

  /**
   * Retrieves student chronological attendance records.
   */
  getStudentHistory: async (
    studentId: number,
    options?: { subjectId?: number }
  ): Promise<any[]> => {
    let sql = `
      SELECT 
        ar.id AS "_id",
        ar.status,
        ar.remarks,
        sess.session_date AS "date",
        sess.period_number AS "periodNumber",
        sub.id AS "subjectDbId",
        sub.subject_code AS "subjectCode",
        sub.subject_name AS "subjectName",
        sec.section_name AS "sectionName"
      FROM attendance_records ar
      JOIN attendance_sessions sess ON ar.attendance_session_id = sess.id
      JOIN subjects sub ON sess.subject_id = sub.id
      JOIN sections sec ON sess.section_id = sec.id
      WHERE ar.student_id = $1
    `;
    const params: any[] = [studentId];

    if (options?.subjectId) {
      sql += ' AND sess.subject_id = $2';
      params.push(options.subjectId);
    }

    sql += ' ORDER BY sess.session_date DESC, sess.period_number DESC;';
    const res = await query(sql, params);

    return res.rows.map(r => ({
      _id: String(r._id),
      date: r.date,
      status: r.status.toLowerCase(),
      subjectId: {
        _id: String(r.subjectDbId),
        subjectCode: r.subjectCode,
        subjectName: r.subjectName,
      },
      section: r.sectionName,
      periodNumber: r.periodNumber,
    }));
  },

  /**
   * Calculates overall and subject-wise attendance percentages for a student.
   */
  getStudentSummary: async (studentId: number): Promise<{
    overall: { total: number; present: number; absent: number; late: number; excused: number; percentage: number | null };
    subjectWise: Array<{
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      percentage: number | null;
    }>;
  }> => {
    const sql = `
      SELECT 
        sub.id AS "subjectId",
        sub.subject_name AS "subjectName",
        sub.subject_code AS "subjectCode",
        COUNT(ar.id) AS total,
        COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) AS present,
        COUNT(CASE WHEN ar.status = 'ABSENT' THEN 1 END) AS absent,
        COUNT(CASE WHEN ar.status = 'LATE' THEN 1 END) AS late,
        COUNT(CASE WHEN ar.status = 'EXCUSED' THEN 1 END) AS excused
      FROM attendance_records ar
      JOIN attendance_sessions sess ON ar.attendance_session_id = sess.id
      JOIN subjects sub ON sess.subject_id = sub.id
      WHERE ar.student_id = $1
      GROUP BY sub.id, sub.subject_name, sub.subject_code
      ORDER BY sub.subject_name ASC;
    `;

    const res = await query(sql, [studentId]);

    let overallTotal = 0;
    let overallPresent = 0;
    let overallAbsent = 0;
    let overallLate = 0;
    let overallExcused = 0;

    const subjectWise = res.rows.map((row: any) => {
      const total = parseInt(row.total, 10);
      const present = parseInt(row.present, 10);
      const absent = parseInt(row.absent, 10);
      const late = parseInt(row.late, 10);
      const excused = parseInt(row.excused, 10);

      overallTotal += total;
      overallPresent += present;
      overallAbsent += absent;
      overallLate += late;
      overallExcused += excused;

      const effectivePresent = present + (late * 0.5) + excused;
      const percentage = total > 0 ? Math.round((effectivePresent / total) * 100) : null;

      return {
        subjectId: String(row.subjectId),
        subjectName: row.subjectName,
        subjectCode: row.subjectCode,
        total,
        present,
        absent,
        late,
        excused,
        percentage,
      };
    });

    const overallEffective = overallPresent + (overallLate * 0.5) + overallExcused;
    const overallPercentage = overallTotal > 0 ? Math.round((overallEffective / overallTotal) * 100) : null;

    return {
      overall: {
        total: overallTotal,
        present: overallPresent,
        absent: overallAbsent,
        late: overallLate,
        excused: overallExcused,
        percentage: overallPercentage,
      },
      subjectWise,
    };
  },

  /**
   * Lock a session to prevent further edits.
   */
  lockSession: async (sessionId: number, userId: number): Promise<void> => {
    await query(
      `UPDATE attendance_sessions 
       SET is_locked = TRUE, locked_at = CURRENT_TIMESTAMP, locked_by = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [sessionId, userId]
    );
  },

  /**
   * Unlock a session (Admin override).
   */
  unlockSession: async (sessionId: number): Promise<void> => {
    await query(
      `UPDATE attendance_sessions 
       SET is_locked = FALSE, locked_at = NULL, locked_by = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [sessionId]
    );
  },
};
