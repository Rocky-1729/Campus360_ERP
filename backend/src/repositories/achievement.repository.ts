import * as db from '../config/database';
import { IAchievement } from '../interfaces/db.interface';

export const achievementRepository = {
  create: async (ach: IAchievement): Promise<number> => {
    const res = await db.run(
      `INSERT INTO achievements (hallTicketNumber, category, title, description, date, documentUrl, status, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ach.hallTicketNumber.toUpperCase().trim(),
        ach.category,
        ach.title,
        ach.description ?? '',
        ach.date,
        ach.documentUrl || null,
        ach.status ?? 'pending',
        ach.remarks ?? '',
      ]
    );
    return res.lastID!;
  },

  findById: async (id: number): Promise<IAchievement | undefined> => {
    return db.get<IAchievement>('SELECT * FROM achievements WHERE id = ?', [id]);
  },

  findByStudent: async (hallTicketNumber: string): Promise<IAchievement[]> => {
    return db.all<IAchievement>(
      'SELECT * FROM achievements WHERE UPPER(hallTicketNumber) = ? ORDER BY createdAt DESC',
      [hallTicketNumber.toUpperCase().trim()]
    );
  },

  findPending: async (): Promise<IAchievement[]> => {
    return db.all<IAchievement>("SELECT * FROM achievements WHERE status = 'pending' ORDER BY createdAt ASC");
  },

  updateStatus: async (id: number, status: 'approved' | 'rejected', remarks: string): Promise<void> => {
    await db.run(
      "UPDATE achievements SET status = ?, remarks = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [status, remarks, id]
    );
  },
};
