import { query } from '../config/database';
import {
  IDepartment,
  IProgram,
  IAcademicBatch,
  ISection,
  IAcademicSession,
  IPgSemester,
} from '../interfaces/db.interface';

export const academicStructureRepository = {
  // ==========================================
  // Departments
  // ==========================================
  getDepartments: async (): Promise<IDepartment[]> => {
    const res = await query<IDepartment>(`
      SELECT id, department_code, department_name, created_at, updated_at
      FROM departments
      ORDER BY department_name ASC
    `);
    return res.rows;
  },

  getDepartmentById: async (id: number | string): Promise<IDepartment | undefined> => {
    const res = await query<IDepartment>(`
      SELECT id, department_code, department_name, created_at, updated_at
      FROM departments
      WHERE id = $1
    `, [id]);
    return res.rows[0];
  },

  // ==========================================
  // Programs
  // ==========================================
  getPrograms: async (departmentId?: number | string | null): Promise<IProgram[]> => {
    const res = await query<IProgram>(`
      SELECT 
        p.id, 
        p.department_id, 
        p.program_code, 
        p.program_name, 
        p.degree, 
        p.duration_years, 
        p.created_at, 
        p.updated_at,
        d.department_name,
        d.department_code
      FROM programs p
      JOIN departments d ON p.department_id = d.id
      WHERE ($1::bigint IS NULL OR p.department_id = $1::bigint)
      ORDER BY p.program_name ASC
    `, [departmentId || null]);
    return res.rows;
  },

  getProgramById: async (id: number | string): Promise<IProgram | undefined> => {
    const res = await query<IProgram>(`
      SELECT 
        p.id, 
        p.department_id, 
        p.program_code, 
        p.program_name, 
        p.degree, 
        p.duration_years, 
        p.created_at, 
        p.updated_at,
        d.department_name,
        d.department_code
      FROM programs p
      JOIN departments d ON p.department_id = d.id
      WHERE p.id = $1
    `, [id]);
    return res.rows[0];
  },

  // ==========================================
  // Academic Batches
  // ==========================================
  getAcademicBatches: async (programId?: number | string | null): Promise<IAcademicBatch[]> => {
    const res = await query<IAcademicBatch>(`
      SELECT 
        b.id, 
        b.program_id, 
        b.batch_name, 
        b.start_year, 
        b.expected_completion_year, 
        b.created_at, 
        b.updated_at,
        p.program_name,
        p.program_code
      FROM academic_batches b
      JOIN programs p ON b.program_id = p.id
      WHERE ($1::bigint IS NULL OR b.program_id = $1::bigint)
      ORDER BY b.start_year DESC, b.batch_name ASC
    `, [programId || null]);
    return res.rows;
  },

  getAcademicBatchById: async (id: number | string): Promise<IAcademicBatch | undefined> => {
    const res = await query<IAcademicBatch>(`
      SELECT 
        b.id, 
        b.program_id, 
        b.batch_name, 
        b.start_year, 
        b.expected_completion_year, 
        b.created_at, 
        b.updated_at,
        p.program_name,
        p.program_code
      FROM academic_batches b
      JOIN programs p ON b.program_id = p.id
      WHERE b.id = $1
    `, [id]);
    return res.rows[0];
  },

  // ==========================================
  // Sections
  // ==========================================
  getSections: async (batchId?: number | string | null): Promise<ISection[]> => {
    const res = await query<ISection>(`
      SELECT 
        s.id, 
        s.academic_batch_id, 
        s.section_name, 
        s.created_at, 
        s.updated_at,
        b.batch_name
      FROM sections s
      JOIN academic_batches b ON s.academic_batch_id = b.id
      WHERE ($1::bigint IS NULL OR s.academic_batch_id = $1::bigint)
      ORDER BY s.section_name ASC
    `, [batchId || null]);
    return res.rows;
  },

  getSectionById: async (id: number | string): Promise<ISection | undefined> => {
    const res = await query<ISection>(`
      SELECT 
        s.id, 
        s.academic_batch_id, 
        s.section_name, 
        s.created_at, 
        s.updated_at,
        b.batch_name
      FROM sections s
      JOIN academic_batches b ON s.academic_batch_id = b.id
      WHERE s.id = $1
    `, [id]);
    return res.rows[0];
  },

  // ==========================================
  // Academic Sessions
  // ==========================================
  getAcademicSessions: async (isActive?: boolean | null): Promise<IAcademicSession[]> => {
    const res = await query<IAcademicSession>(`
      SELECT id, session_name, start_date, end_date, is_active, created_at, updated_at
      FROM academic_sessions
      WHERE ($1::boolean IS NULL OR is_active = $1::boolean)
      ORDER BY start_date DESC NULLS LAST, session_name DESC
    `, [isActive !== undefined ? isActive : null]);
    return res.rows;
  },

  getAcademicSessionById: async (id: number | string): Promise<IAcademicSession | undefined> => {
    const res = await query<IAcademicSession>(`
      SELECT id, session_name, start_date, end_date, is_active, created_at, updated_at
      FROM academic_sessions
      WHERE id = $1
    `, [id]);
    return res.rows[0];
  },

  // ==========================================
  // Semesters
  // ==========================================
  getSemesters: async (): Promise<IPgSemester[]> => {
    const res = await query<IPgSemester>(`
      SELECT id, semester_number, year_number, semester_name, created_at
      FROM semesters
      ORDER BY semester_number ASC
    `);
    return res.rows;
  },

  getSemesterById: async (id: number | string): Promise<IPgSemester | undefined> => {
    const res = await query<IPgSemester>(`
      SELECT id, semester_number, year_number, semester_name, created_at
      FROM semesters
      WHERE id = $1
    `, [id]);
    return res.rows[0];
  },
};
