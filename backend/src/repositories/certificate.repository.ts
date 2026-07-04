import * as db from '../config/database';
import { ICertificate } from '../interfaces/db.interface';

export const certificateRepository = {
  create: async (cert: ICertificate): Promise<number> => {
    const res = await db.run(
      `INSERT INTO certificates (hallTicketNumber, type, title, issuingOrganization, issueDate, certificateUrl, status, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cert.hallTicketNumber.toUpperCase().trim(),
        cert.type,
        cert.title,
        cert.issuingOrganization,
        cert.issueDate,
        cert.certificateUrl,
        cert.status ?? 'pending',
        cert.remarks ?? '',
      ]
    );
    return res.lastID!;
  },

  findById: async (id: number): Promise<ICertificate | undefined> => {
    return db.get<ICertificate>('SELECT * FROM certificates WHERE id = ?', [id]);
  },

  findByStudent: async (hallTicketNumber: string): Promise<ICertificate[]> => {
    return db.all<ICertificate>(
      'SELECT * FROM certificates WHERE UPPER(hallTicketNumber) = ? ORDER BY createdAt DESC',
      [hallTicketNumber.toUpperCase().trim()]
    );
  },

  findPending: async (): Promise<ICertificate[]> => {
    return db.all<ICertificate>("SELECT * FROM certificates WHERE status = 'pending' ORDER BY createdAt ASC");
  },

  updateStatus: async (id: number, status: 'approved' | 'rejected', remarks: string): Promise<void> => {
    await db.run(
      "UPDATE certificates SET status = ?, remarks = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [status, remarks, id]
    );
  },
};
