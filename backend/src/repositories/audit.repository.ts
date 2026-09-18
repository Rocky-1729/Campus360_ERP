import { getSqliteDB } from '../config/sqliteDatabase';
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
    try {
      const sdb = await getSqliteDB();
      const res = await sdb.run(
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
      return res.lastID ?? 0;
    } catch {
      return 0;
    }
  },

  findRecent: async (limit: number = 20): Promise<IAuditLog[]> => {
    try {
      const sdb = await getSqliteDB();
      return (await sdb.all<any>(
        'SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT ?',
        [limit]
      )) || [];
    } catch {
      return [];
    }
  },

  findByUser: async (userId: number): Promise<IAuditLog[]> => {
    try {
      const sdb = await getSqliteDB();
      return (await sdb.all<any>(
        'SELECT * FROM audit_logs WHERE userId = ? ORDER BY createdAt DESC',
        [userId]
      )) || [];
    } catch {
      return [];
    }
  },
};
