import { api } from './api';

export interface DepartmentItem {
  id: string;
  departmentCode: string;
  departmentName: string;
  hodName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface ProgramItem {
  id: string;
  programCode: string;
  programName: string;
  departmentId: string;
  departmentCode?: string;
  departmentName?: string;
  degree: string;
  durationYears: number;
}

export interface AcademicBatchItem {
  id: string;
  batchName: string;
  startYear: number;
  expectedCompletionYear: number;
  programId: string;
  programCode?: string;
  programName?: string;
}

export interface SectionItem {
  id: string;
  sectionName: string;
  academicBatchId: string;
  batchName?: string;
}

export interface AcademicSessionItem {
  id: string;
  sessionName: string;
  startDate: string;
  endDate: string;
}

export interface SemesterItem {
  id: string;
  semesterNumber: number;
  semesterName: string;
}

export const academicService = {
  getDepartments: async (): Promise<DepartmentItem[]> => {
    const res: any = await api.get('/departments');
    return res.data || [];
  },

  getPrograms: async (departmentId?: string | number): Promise<ProgramItem[]> => {
    const params = departmentId ? { departmentId } : {};
    const res: any = await api.get('/programs', { params });
    return res.data || [];
  },

  getBatches: async (programId?: string | number): Promise<AcademicBatchItem[]> => {
    const params = programId ? { programId } : {};
    const res: any = await api.get('/academic-batches', { params });
    return res.data || [];
  },

  getSections: async (batchId?: string | number): Promise<SectionItem[]> => {
    const params = batchId ? { batchId } : {};
    const res: any = await api.get('/sections', { params });
    return res.data || [];
  },

  getSessions: async (): Promise<AcademicSessionItem[]> => {
    const res: any = await api.get('/academic-sessions');
    return res.data || [];
  },

  getSemesters: async (): Promise<SemesterItem[]> => {
    const res: any = await api.get('/semesters');
    return res.data || [];
  },
};
