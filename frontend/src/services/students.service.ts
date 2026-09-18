import { api } from './api';

export interface StudentListItem {
  id: string;
  hallTicketNumber: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  departmentId?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  programId?: string | null;
  programCode?: string | null;
  programName?: string | null;
  batchId?: string | null;
  batchName?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  enrollmentStatus?: string | null;
  joinedDate?: string | null;
}

export interface StudentProfileData extends StudentListItem {
  degree?: string;
  durationYears?: number;
  batchStartYear?: number;
  batchExpectedCompletionYear?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentListResponse {
  students: StudentListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StudentFilterParams {
  search?: string;
  departmentId?: string | number;
  programId?: string | number;
  batchId?: string | number;
  sectionId?: string | number;
  status?: string;
  page?: number;
  limit?: number;
}

export interface StudentStatusCounts {
  students: number;
  enrollments: number;
}

export const studentsService = {
  /**
   * Retrieves paginated students matching filters.
   */
  getStudents: async (params?: StudentFilterParams): Promise<StudentListResponse> => {
    const cleanParams: Record<string, any> = {};
    if (params) {
      if (params.search) cleanParams.search = params.search.trim();
      if (params.departmentId) cleanParams.departmentId = params.departmentId;
      if (params.programId) cleanParams.programId = params.programId;
      if (params.batchId) cleanParams.batchId = params.batchId;
      if (params.sectionId) cleanParams.sectionId = params.sectionId;
      if (params.status) cleanParams.status = params.status;
      if (params.page) cleanParams.page = params.page;
      if (params.limit) cleanParams.limit = params.limit;
    }

    const res: any = await api.get('/students', { params: cleanParams });
    return res.data || { students: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  },

  /**
   * Retrieves single student profile by numeric ID or Hall Ticket Number.
   */
  getStudentById: async (identifier: string): Promise<StudentProfileData> => {
    const res: any = await api.get(`/students/${encodeURIComponent(identifier)}`);
    return res.data;
  },

  /**
   * Retrieves live student counts from PostgreSQL.
   */
  getStatusCounts: async (): Promise<StudentStatusCounts> => {
    const res: any = await api.get('/students/status/counts');
    return res.data || { students: 0, enrollments: 0 };
  },
};
