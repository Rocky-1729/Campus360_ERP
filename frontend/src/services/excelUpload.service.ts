import { api } from './api';

export type ExcelFileType = 'STUDENT_MASTER' | 'EXAMINATION_RESULT';

export interface DetectionResult {
  fileType: ExcelFileType | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sheetName: string;
  reasons: string[];
}

export interface StudentMasterPreviewData {
  importToken: string;
  fileType: 'STUDENT_MASTER';
  fileName: string;
  fileHash: string;
  detection: DetectionResult;
  metadata: {
    course?: string;
    branch?: string;
    semester?: string;
    batch?: string;
    section?: string;
  };
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  };
  preview: Array<{
    rowNumber: number;
    hallTicketNumber: string;
    fullName: string;
    gender: string | null;
    dateOfBirth: string | null;
    email: string | null;
    phoneNumber: string | null;
  }>;
  validationErrors: Array<{
    rowNumber: number;
    hallTicketNumber?: string;
    errors: string[];
  }>;
}

export interface ExaminationResultPreviewData {
  importToken: string;
  fileType: 'EXAMINATION_RESULT';
  fileName: string;
  fileHash: string;
  detection: DetectionResult;
  metadata: {
    examinationName?: string;
    academicSession?: string;
    semester?: string;
    semesterNumber?: number;
    examType?: 'REGULAR' | 'SUPPLEMENTARY';
    examinationType?: 'REGULAR' | 'SUPPLEMENTARY';
    branch?: string;
    regulation?: string;
  };
  detectedSubjects: Array<{
    subjectCode: string;
    hasInternal: boolean;
    hasExternal: boolean;
    hasTotal: boolean;
    hasGrade: boolean;
  }>;
  summary: {
    totalStudents: number;
    validStudents: number;
    invalidStudents: number;
    totalSubjectScores: number;
    errorSummary?: Record<string, number>;
  };
  preview: Array<{
    rowNumber: number;
    hallTicketNumber: string;
    subjectCount: number;
    sampleScores: Array<{
      subjectCode: string;
      internalMarks: number | null;
      externalMarks: number | null;
      totalMarks: number | null;
      grade: string | null;
      resultStatus: string;
    }>;
    sgpa: number | null;
    cgpa: number | null;
    overallResult: string | null;
  }>;
  validationErrors: Array<{
    rowNumber: number;
    hallTicketNumber?: string;
    status?: string;
    reason?: string;
    errors: string[];
  }>;
}

export type ExcelPreviewResponse = StudentMasterPreviewData | ExaminationResultPreviewData;

export interface StudentMasterImportResult {
  fileName: string;
  totalStudentsInExcel: number;
  insertedStudents: number;
  skippedStudents: number;
  enrolledStudents: number;
  batchId?: number;
  sectionId?: number;
  skippedDetails?: Array<{ hallTicket: string; reason: string }>;
}

export interface ExaminationImportResult {
  fileName: string;
  examinationId: number;
  examinationName: string;
  totalStudentsInExcel: number;
  studentsProcessed: number;
  resultsInserted: number;
  resultsSkipped: number;
  semesterSummariesInserted: number;
  studentsNotFound: string[];
  subjectsNotFound: string[];
}

export interface UploadHistoryItem {
  id: string;
  fileName: string;
  fileHash: string;
  examinationId?: string;
  examinationName?: string;
  examType?: 'REGULAR' | 'SUPPLEMENTARY';
  semesterNumber?: number;
  semesterName?: string;
  uploadStatus: 'UPLOADED' | 'VALIDATING' | 'VALIDATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errorMessage?: string;
  uploadedAt: string;
}

export const excelUploadService = {
  /**
   * Uploads spreadsheet to generate a preview and receive a secure staging token.
   */
  previewFile: async (file: File): Promise<ExcelPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const res: any = await api.post('/excel-upload/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return res.data;
  },

  /**
   * Confirms import using staged token and contextual IDs.
   */
  confirmImport: async (payload: {
    token: string;
    batchId?: number;
    sectionId?: number;
    examinationId?: number;
  }): Promise<StudentMasterImportResult | ExaminationImportResult> => {
    const res: any = await api.post('/excel-upload/import', payload);
    return res.data;
  },

  /**
   * Retrieves past upload history audit logs from PostgreSQL.
   */
  getUploadHistory: async (): Promise<UploadHistoryItem[]> => {
    const res: any = await api.get('/excel-upload/history');
    return res.data || [];
  },
};
