import { api } from './api';

export interface ExaminationItem {
  id: string;
  academicSessionId: string;
  sessionName?: string;
  semesterId: string;
  semesterNumber?: number;
  semesterName?: string;
  examType: 'REGULAR' | 'SUPPLEMENTARY';
  examName: string;
  examDate?: string;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  createdAt?: string;
  updatedAt?: string;
}

export interface SubjectItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  credits?: number;
  maximumInternalMarks?: number;
  maximumExternalMarks?: number;
  maximumTotalMarks?: number;
  semesterNumber?: number;
  semesterName?: string;
  programName?: string;
  batchName?: string;
}

export interface CurriculumSubjectItem {
  id: string;
  batchId: string;
  batchName?: string;
  programId: string;
  programCode?: string;
  programName?: string;
  semesterId: string;
  semesterNumber?: number;
  semesterName?: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  maximumInternalMarks?: number;
  maximumExternalMarks?: number;
  maximumTotalMarks?: number;
  credits?: number;
}

export interface ExamStructureCounts {
  subjects: number;
  curriculumSubjects: number;
  examinations: number;
  examResults: number;
  studentSemesterResults: number;
  excelUploads: number;
}

export const examinationsService = {
  getExaminations: async (filters?: {
    academicSessionId?: string | number;
    semesterId?: string | number;
    examinationType?: string;
    status?: string;
  }): Promise<ExaminationItem[]> => {
    const res: any = await api.get('/examinations', { params: filters });
    return res.data || [];
  },

  createExamination: async (data: {
    academicSessionId: string | number;
    semesterId: string | number;
    examType: 'REGULAR' | 'SUPPLEMENTARY';
    examName: string;
    examDate?: string;
    status?: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  }): Promise<ExaminationItem> => {
    const res: any = await api.post('/examinations', data);
    return res.data;
  },

  getSubjects: async (filters?: {
    search?: string;
    semesterId?: string | number;
    programId?: string | number;
    batchId?: string | number;
  }): Promise<SubjectItem[]> => {
    const res: any = await api.get('/subjects', { params: filters });
    return res.data || [];
  },

  getCurriculumSubjects: async (filters?: {
    batchId?: string | number;
    semesterId?: string | number;
  }): Promise<CurriculumSubjectItem[]> => {
    const res: any = await api.get('/curriculum-subjects', { params: filters });
    return res.data || [];
  },

  getTableCounts: async (): Promise<ExamStructureCounts> => {
    const res: any = await api.get('/exam-structure/counts');
    return res.data || {
      subjects: 0,
      curriculumSubjects: 0,
      examinations: 0,
      examResults: 0,
      studentSemesterResults: 0,
      excelUploads: 0,
    };
  },
};
