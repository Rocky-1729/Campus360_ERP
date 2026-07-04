import * as db from '../config/database';
import { IUploadHistory } from '../interfaces/db.interface';

export const uploadRepository = {
  logUpload: async (upload: {
    uploadedBy: number;
    fileName: string;
    semester?: string;
    year?: string;
    recordsImported?: number;
    status?: string;
  }): Promise<number> => {
    const res = await db.run(
      `INSERT INTO upload_history (uploadedBy, fileName, semester, year, recordsImported, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        upload.uploadedBy,
        upload.fileName,
        upload.semester || '',
        upload.year || '',
        upload.recordsImported ?? 0,
        upload.status ?? 'Success',
      ]
    );
    return res.lastID!;
  },

  getHistory: async (): Promise<IUploadHistory[]> => {
    return db.all<IUploadHistory>(`
      SELECT uh.*, u.username as uploadedByName
      FROM upload_history uh
      JOIN users u ON uh.uploadedBy = u.id
      ORDER BY uh.uploadedAt DESC
    `);
  },
};
