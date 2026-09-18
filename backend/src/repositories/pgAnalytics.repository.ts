import { query } from '../config/database';
import { logger } from '../utils/logger';

export interface AnalyticsFilter {
  departmentId?: number;
  programId?: number;
  academicBatchId?: number;
  semesterId?: number;
  academicSessionId?: number;
  examinationId?: number;
}

export interface OverviewAnalyticsResult {
  totalStudents: number;
  studentsWithResults: number;
  totalExaminations: number;
  totalSubjects: number;
  passedStudents: number;
  failedStudents: number;
  passPercentage: number | null;
  averageSGPA: number | null;
  averageCGPA: number | null;
  cgpaDistribution: Record<string, number>;
  backlogDistribution: {
    zeroBacklogs: number;
    oneBacklog: number;
    twoBacklogs: number;
    threeOrMoreBacklogs: number;
    totalBacklogStudents: number;
  };
}

export interface DepartmentAnalyticsRow {
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  totalStudents: number;
  studentsWithResults: number;
  passedStudents: number;
  failedStudents: number;
  passPercentage: number | null;
  averageSGPA: number | null;
  averageCGPA: number | null;
}

export interface SubjectPerformanceRow {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  appeared: number;
  passed: number;
  failed: number;
  absent: number;
  passPercentage: number | null;
  averageInternalMarks: number | null;
  averageExternalMarks: number | null;
  averageTotalMarks: number | null;
  gradeDistribution: Record<string, number>;
}

export interface ExaminationPerformanceResult {
  examination: {
    id: number;
    examName: string;
    examType: string;
    examDate: string | null;
    status: string;
    semesterName: string;
    sessionName: string;
  };
  totalAppeared: number;
  passedCount: number;
  failedCount: number;
  passPercentage: number | null;
  averageSGPA: number | null;
  gradeDistribution: Record<string, number>;
  subjects: SubjectPerformanceRow[];
}

export const pgAnalyticsRepository = {
  /**
   * Get college-wide overview metrics with filters
   */
  async getOverviewAnalytics(filters: AnalyticsFilter): Promise<OverviewAnalyticsResult> {
    // 1. Build filter conditions for student-enrollment hierarchy
    const studentConditions: string[] = ['1=1'];
    const studentParams: any[] = [];
    let pIdx = 1;

    if (filters.departmentId) {
      studentConditions.push(`p.department_id = $${pIdx++}`);
      studentParams.push(filters.departmentId);
    }
    if (filters.programId) {
      studentConditions.push(`ab.program_id = $${pIdx++}`);
      studentParams.push(filters.programId);
    }
    if (filters.academicBatchId) {
      studentConditions.push(`sae.academic_batch_id = $${pIdx++}`);
      studentParams.push(filters.academicBatchId);
    }

    // Total Students matching academic filter
    const totalStudentsSql = `
      SELECT COUNT(DISTINCT s.id) AS count
      FROM students s
      LEFT JOIN student_academic_enrollments sae ON s.id = sae.student_id
      LEFT JOIN academic_batches ab ON sae.academic_batch_id = ab.id
      LEFT JOIN programs p ON ab.program_id = p.id
      WHERE ${studentConditions.join(' AND ')}
    `;
    const totalStudentsRes = await query(totalStudentsSql, studentParams);
    const totalStudents = parseInt(totalStudentsRes.rows[0]?.count || '0', 10);

    // Total Examinations count
    const totalExamsRes = await query(`SELECT COUNT(*) AS count FROM examinations WHERE status != 'CANCELLED'`);
    const totalExaminations = parseInt(totalExamsRes.rows[0]?.count || '0', 10);

    // Total Subjects count
    const totalSubjectsRes = await query(`SELECT COUNT(*) AS count FROM subjects`);
    const totalSubjects = parseInt(totalSubjectsRes.rows[0]?.count || '0', 10);

    // 2. Build filter conditions for student_semester_results
    const ssrConditions: string[] = ['1=1'];
    const ssrParams: any[] = [];
    let ssrIdx = 1;

    if (filters.departmentId) {
      ssrConditions.push(`p.department_id = $${ssrIdx++}`);
      ssrParams.push(filters.departmentId);
    }
    if (filters.programId) {
      ssrConditions.push(`ab.program_id = $${ssrIdx++}`);
      ssrParams.push(filters.programId);
    }
    if (filters.academicBatchId) {
      ssrConditions.push(`sae.academic_batch_id = $${ssrIdx++}`);
      ssrParams.push(filters.academicBatchId);
    }
    if (filters.semesterId) {
      ssrConditions.push(`ssr.semester_id = $${ssrIdx++}`);
      ssrParams.push(filters.semesterId);
    }
    if (filters.academicSessionId) {
      ssrConditions.push(`ssr.academic_session_id = $${ssrIdx++}`);
      ssrParams.push(filters.academicSessionId);
    }
    if (filters.examinationId) {
      ssrConditions.push(`ssr.examination_id = $${ssrIdx++}`);
      ssrParams.push(filters.examinationId);
    }

    const ssrWhere = ssrConditions.join(' AND ');

    // Metrics query over student_semester_results
    const metricsSql = `
      SELECT 
        COUNT(DISTINCT ssr.student_id) AS "studentsWithResults",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.overall_result = 'PASS') AS "passedStudents",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.overall_result = 'FAIL') AS "failedStudents",
        ROUND(AVG(ssr.sgpa)::numeric, 2)::float AS "averageSGPA",
        ROUND(AVG(ssr.cgpa)::numeric, 2)::float AS "averageCGPA",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.cgpa >= 9.0 AND ssr.cgpa <= 10.0) AS "cgpa9To10",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.cgpa >= 8.0 AND ssr.cgpa < 9.0) AS "cgpa8To9",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.cgpa >= 7.0 AND ssr.cgpa < 8.0) AS "cgpa7To8",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.cgpa >= 6.0 AND ssr.cgpa < 7.0) AS "cgpa6To7",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.cgpa < 6.0 AND ssr.cgpa >= 0.0) AS "cgpaBelow6"
      FROM student_semester_results ssr
      JOIN students s ON ssr.student_id = s.id
      LEFT JOIN student_academic_enrollments sae ON s.id = sae.student_id
      LEFT JOIN academic_batches ab ON sae.academic_batch_id = ab.id
      LEFT JOIN programs p ON ab.program_id = p.id
      WHERE ${ssrWhere}
    `;
    const metricsRes = await query(metricsSql, ssrParams);
    const m = metricsRes.rows[0] || {};

    const studentsWithResults = parseInt(m.studentsWithResults || '0', 10);
    const passedStudents = parseInt(m.passedStudents || '0', 10);
    const failedStudents = parseInt(m.failedStudents || '0', 10);
    const averageSGPA = m.averageSGPA != null ? Number(m.averageSGPA) : null;
    const averageCGPA = m.averageCGPA != null ? Number(m.averageCGPA) : null;

    const passPercentage =
      studentsWithResults > 0
        ? Math.round(((passedStudents * 100.0) / studentsWithResults) * 100) / 100
        : null;

    const cgpaDistribution: Record<string, number> = {
      '9.0 - 10.0': parseInt(m.cgpa9To10 || '0', 10),
      '8.0 - 8.99': parseInt(m.cgpa8To9 || '0', 10),
      '7.0 - 7.99': parseInt(m.cgpa7To8 || '0', 10),
      '6.0 - 6.99': parseInt(m.cgpa6To7 || '0', 10),
      '< 6.0': parseInt(m.cgpaBelow6 || '0', 10),
    };

    // 3. Active Backlogs Calculation using Latest Attempt per (student, subject)
    const backlogSql = `
      WITH latest_attempts AS (
        SELECT 
          er.student_id,
          er.subject_id,
          er.result_status,
          ROW_NUMBER() OVER (
            PARTITION BY er.student_id, er.subject_id 
            ORDER BY COALESCE(e.exam_date, e.created_at::date) DESC, er.attempt_number DESC, er.id DESC
          ) AS rank
        FROM exam_results er
        JOIN examinations e ON er.examination_id = e.id
        JOIN students s ON er.student_id = s.id
        LEFT JOIN student_academic_enrollments sae ON s.id = sae.student_id
        LEFT JOIN academic_batches ab ON sae.academic_batch_id = ab.id
        LEFT JOIN programs p ON ab.program_id = p.id
        WHERE ${studentConditions.join(' AND ')}
      ),
      student_backlog_counts AS (
        SELECT 
          student_id,
          COUNT(*) FILTER (WHERE result_status IN ('FAIL', 'ABSENT', 'WITHHELD')) AS active_backlogs
        FROM latest_attempts
        WHERE rank = 1
        GROUP BY student_id
      )
      SELECT 
        COUNT(*) FILTER (WHERE active_backlogs = 0) AS "zeroBacklogs",
        COUNT(*) FILTER (WHERE active_backlogs = 1) AS "oneBacklog",
        COUNT(*) FILTER (WHERE active_backlogs = 2) AS "twoBacklogs",
        COUNT(*) FILTER (WHERE active_backlogs >= 3) AS "threeOrMoreBacklogs",
        COUNT(*) FILTER (WHERE active_backlogs > 0) AS "totalBacklogStudents"
      FROM student_backlog_counts
    `;
    const backlogRes = await query(backlogSql, studentParams);
    const b = backlogRes.rows[0] || {};

    const backlogDistribution = {
      zeroBacklogs: parseInt(b.zeroBacklogs || '0', 10),
      oneBacklog: parseInt(b.oneBacklog || '0', 10),
      twoBacklogs: parseInt(b.twoBacklogs || '0', 10),
      threeOrMoreBacklogs: parseInt(b.threeOrMoreBacklogs || '0', 10),
      totalBacklogStudents: parseInt(b.totalBacklogStudents || '0', 10),
    };

    return {
      totalStudents,
      studentsWithResults,
      totalExaminations,
      totalSubjects,
      passedStudents,
      failedStudents,
      passPercentage,
      averageSGPA,
      averageCGPA,
      cgpaDistribution,
      backlogDistribution,
    };
  },

  /**
   * Get department-level analytics breakdown
   */
  async getDepartmentAnalytics(filters?: { departmentId?: number }): Promise<DepartmentAnalyticsRow[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    if (filters?.departmentId) {
      conditions.push(`d.id = $1`);
      params.push(filters.departmentId);
    }

    const sql = `
      SELECT 
        d.id AS "departmentId",
        d.department_code AS "departmentCode",
        d.department_name AS "departmentName",
        COUNT(DISTINCT s.id) AS "totalStudents",
        COUNT(DISTINCT ssr.student_id) AS "studentsWithResults",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.overall_result = 'PASS') AS "passedStudents",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.overall_result = 'FAIL') AS "failedStudents",
        ROUND(AVG(ssr.sgpa)::numeric, 2)::float AS "averageSGPA",
        ROUND(AVG(ssr.cgpa)::numeric, 2)::float AS "averageCGPA"
      FROM departments d
      LEFT JOIN programs p ON p.department_id = d.id
      LEFT JOIN academic_batches ab ON ab.program_id = p.id
      LEFT JOIN student_academic_enrollments sae ON sae.academic_batch_id = ab.id
      LEFT JOIN students s ON sae.student_id = s.id
      LEFT JOIN student_semester_results ssr ON ssr.student_id = s.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY d.id, d.department_code, d.department_name
      ORDER BY d.department_name ASC
    `;
    const res = await query(sql, params);

    return res.rows.map((r: any) => {
      const studentsWithResults = parseInt(r.studentsWithResults || '0', 10);
      const passedStudents = parseInt(r.passedStudents || '0', 10);
      const failedStudents = parseInt(r.failedStudents || '0', 10);
      const passPercentage =
        studentsWithResults > 0
          ? Math.round(((passedStudents * 100.0) / studentsWithResults) * 100) / 100
          : null;

      return {
        departmentId: Number(r.departmentId),
        departmentCode: r.departmentCode,
        departmentName: r.departmentName,
        totalStudents: parseInt(r.totalStudents || '0', 10),
        studentsWithResults,
        passedStudents,
        failedStudents,
        passPercentage,
        averageSGPA: r.averageSGPA != null ? Number(r.averageSGPA) : null,
        averageCGPA: r.averageCGPA != null ? Number(r.averageCGPA) : null,
      };
    });
  },

  /**
   * Get comprehensive performance analytics for a single examination
   */
  async getExaminationPerformance(examinationId: number): Promise<ExaminationPerformanceResult | null> {
    // 1. Fetch examination metadata
    const examSql = `
      SELECT 
        e.id,
        e.exam_name AS "examName",
        e.exam_type AS "examType",
        e.exam_date AS "examDate",
        e.status,
        sem.semester_name AS "semesterName",
        sess.session_name AS "sessionName"
      FROM examinations e
      JOIN semesters sem ON e.semester_id = sem.id
      JOIN academic_sessions sess ON e.academic_session_id = sess.id
      WHERE e.id = $1
    `;
    const examRes = await query(examSql, [examinationId]);
    if (examRes.rows.length === 0) {
      return null;
    }
    const exam = examRes.rows[0];

    // 2. Examination-wide metrics from student_semester_results
    const examMetricsSql = `
      SELECT 
        COUNT(DISTINCT ssr.student_id) AS "totalAppeared",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.overall_result = 'PASS') AS "passedCount",
        COUNT(DISTINCT ssr.student_id) FILTER (WHERE ssr.overall_result = 'FAIL') AS "failedCount",
        ROUND(AVG(ssr.sgpa)::numeric, 2)::float AS "averageSGPA"
      FROM student_semester_results ssr
      WHERE ssr.examination_id = $1
    `;
    const examMetricsRes = await query(examMetricsSql, [examinationId]);
    const em = examMetricsRes.rows[0] || {};
    const totalAppeared = parseInt(em.totalAppeared || '0', 10);
    const passedCount = parseInt(em.passedCount || '0', 10);
    const failedCount = parseInt(em.failedCount || '0', 10);
    const averageSGPA = em.averageSGPA != null ? Number(em.averageSGPA) : null;
    const passPercentage =
      totalAppeared > 0
        ? Math.round(((passedCount * 100.0) / totalAppeared) * 100) / 100
        : null;

    // 3. Overall Grade Distribution for this examination
    const gradeSql = `
      SELECT 
        COALESCE(er.grade, 'NO_GRADE') AS grade,
        COUNT(er.id) AS count
      FROM exam_results er
      WHERE er.examination_id = $1
      GROUP BY er.grade
      ORDER BY grade ASC
    `;
    const gradeRes = await query(gradeSql, [examinationId]);
    const gradeDistribution: Record<string, number> = {};
    gradeRes.rows.forEach((r: any) => {
      gradeDistribution[r.grade] = parseInt(r.count, 10);
    });

    // 4. Subject-by-Subject performance analytics
    const subjectSql = `
      SELECT 
        sub.id AS "subjectId",
        sub.subject_code AS "subjectCode",
        sub.subject_name AS "subjectName",
        COUNT(er.id) AS appeared,
        COUNT(er.id) FILTER (WHERE er.result_status = 'PASS') AS passed,
        COUNT(er.id) FILTER (WHERE er.result_status = 'FAIL') AS failed,
        COUNT(er.id) FILTER (WHERE er.result_status = 'ABSENT') AS absent,
        ROUND(AVG(er.internal_marks)::numeric, 2)::float AS "averageInternalMarks",
        ROUND(AVG(er.external_marks)::numeric, 2)::float AS "averageExternalMarks",
        ROUND(AVG(er.total_marks)::numeric, 2)::float AS "averageTotalMarks"
      FROM exam_results er
      JOIN subjects sub ON er.subject_id = sub.id
      WHERE er.examination_id = $1
      GROUP BY sub.id, sub.subject_code, sub.subject_name
      ORDER BY sub.subject_code ASC
    `;
    const subjectRes = await query(subjectSql, [examinationId]);

    // 5. Subject grade breakdowns
    const subjectGradesSql = `
      SELECT 
        er.subject_id AS "subjectId",
        COALESCE(er.grade, 'NO_GRADE') AS grade,
        COUNT(er.id) AS count
      FROM exam_results er
      WHERE er.examination_id = $1
      GROUP BY er.subject_id, er.grade
    `;
    const subjectGradesRes = await query(subjectGradesSql, [examinationId]);
    const subjectGradesMap: Record<number, Record<string, number>> = {};
    subjectGradesRes.rows.forEach((r: any) => {
      const sId = Number(r.subjectId);
      if (!subjectGradesMap[sId]) subjectGradesMap[sId] = {};
      subjectGradesMap[sId][r.grade] = parseInt(r.count, 10);
    });

    const subjects: SubjectPerformanceRow[] = subjectRes.rows.map((s: any) => {
      const sAppeared = parseInt(s.appeared || '0', 10);
      const sPassed = parseInt(s.passed || '0', 10);
      const sFailed = parseInt(s.failed || '0', 10);
      const sAbsent = parseInt(s.absent || '0', 10);
      const sPassPercentage =
        sAppeared > 0 ? Math.round(((sPassed * 100.0) / sAppeared) * 100) / 100 : null;

      return {
        subjectId: Number(s.subjectId),
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        appeared: sAppeared,
        passed: sPassed,
        failed: sFailed,
        absent: sAbsent,
        passPercentage: sPassPercentage,
        averageInternalMarks: s.averageInternalMarks != null ? Number(s.averageInternalMarks) : null,
        averageExternalMarks: s.averageExternalMarks != null ? Number(s.averageExternalMarks) : null,
        averageTotalMarks: s.averageTotalMarks != null ? Number(s.averageTotalMarks) : null,
        gradeDistribution: subjectGradesMap[Number(s.subjectId)] || {},
      };
    });

    return {
      examination: {
        id: Number(exam.id),
        examName: exam.examName,
        examType: exam.examType,
        examDate: exam.examDate,
        status: exam.status,
        semesterName: exam.semesterName,
        sessionName: exam.sessionName,
      },
      totalAppeared,
      passedCount,
      failedCount,
      passPercentage,
      averageSGPA,
      gradeDistribution,
      subjects,
    };
  },
};
