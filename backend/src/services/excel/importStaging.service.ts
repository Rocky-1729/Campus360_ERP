import crypto from 'crypto';
import { StudentMasterParseResult } from './studentMasterParser';
import { ExaminationResultParseResult } from './examinationResultParser';

export interface StagedImport {
  token: string;
  fileType: 'STUDENT_MASTER' | 'EXAMINATION_RESULT';
  fileName: string;
  fileHash: string;
  studentData?: StudentMasterParseResult;
  examData?: ExaminationResultParseResult;
  createdAt: number;
  expiresAt: number;
}

class ImportStagingService {
  private stagingStore: Map<string, StagedImport> = new Map();
  private readonly TTL_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Auto cleanup expired tokens every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  public stageStudentMaster(
    fileName: string,
    fileHash: string,
    data: StudentMasterParseResult
  ): string {
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    this.stagingStore.set(token, {
      token,
      fileType: 'STUDENT_MASTER',
      fileName,
      fileHash,
      studentData: data,
      createdAt: now,
      expiresAt: now + this.TTL_MS,
    });

    return token;
  }

  public stageExaminationResult(
    fileName: string,
    fileHash: string,
    data: ExaminationResultParseResult
  ): string {
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    this.stagingStore.set(token, {
      token,
      fileType: 'EXAMINATION_RESULT',
      fileName,
      fileHash,
      examData: data,
      createdAt: now,
      expiresAt: now + this.TTL_MS,
    });

    return token;
  }

  public getStaged(token: string): StagedImport | null {
    const item = this.stagingStore.get(token);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.stagingStore.delete(token);
      return null;
    }

    return item;
  }

  public consume(token: string): StagedImport | null {
    const item = this.getStaged(token);
    if (item) {
      this.stagingStore.delete(token);
    }
    return item;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [token, item] of this.stagingStore.entries()) {
      if (now > item.expiresAt) {
        this.stagingStore.delete(token);
      }
    }
  }
}

export const importStagingService = new ImportStagingService();
