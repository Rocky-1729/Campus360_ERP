import * as db from '../config/database';
import { IAuditLog } from '../interfaces/db.interface';

export const auditRepository = {
  log: async (logEntry: {
    userId: number;
    username: string;
    role: string;
    action: string;
    tableName: string;
    recordId?: number;
    ipAddress?: string;
  }): Promise<number> => {
    const res = await db.run(
      `INSERT INTO audit_logs (userId, username, role, action, tableName, recordId, ipAddress)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        logEntry.userId,
        logEntry.username,
        logEntry.role,
        logEntry.action,
        logEntry.tableName,
        logEntry.recordId || null,
        logEntry.ipAddress || '',
      ]
    );
    return res.lastID!;
  },

  findRecent: async (limit: number = 20): Promise<IAuditLog[]> => {
    return db.all<IAuditLog>(
      'SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT ?',
      [limit]
    );
  },

  findByUser: async (userId: number): Promise<IAuditLog[]> => {
    return db.all<IAuditLog>(
      'SELECT * FROM audit_logs WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    );
  },
};
