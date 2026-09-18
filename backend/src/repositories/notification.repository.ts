import { getSqliteDB } from '../config/sqliteDatabase';
import { INotification } from '../interfaces/db.interface';
import { logger } from '../utils/logger';

export const notificationRepository = {
  create: async (notif: INotification): Promise<number> => {
    try {
      const sdb = await getSqliteDB();
      const res = await sdb.run(
        'INSERT INTO notifications (senderId, senderName, type, title, message, targetRole, targetSection) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          notif.senderId,
          notif.senderName,
          notif.type,
          notif.title,
          notif.message,
          notif.targetRole,
          notif.targetSection || '',
        ]
      );
      return res.lastID!;
    } catch (err) {
      logger.warn('Error creating notification in SQLite:', err);
      return 0;
    }
  },

  findForUser: async (userId: number, role: string, section?: string): Promise<INotification[]> => {
    try {
      const sdb = await getSqliteDB();
      let sql = `
        SELECT n.*, EXISTS(
          SELECT 1 FROM notification_reads WHERE notificationId = n.id AND userId = ?
        ) as isRead
        FROM notifications n
      `;
      const params: any[] = [userId];

      if (role === 'student') {
        sql += " WHERE (n.targetRole = 'student' AND (n.targetSection = ? OR n.targetSection = '')) OR n.targetRole = 'all'";
        params.push(section || '');
      }
      
      sql += ' ORDER BY n.createdAt DESC';
      return (await sdb.all(sql, params)) as any[];
    } catch (err) {
      logger.warn('Error fetching notifications from SQLite:', err);
      return [];
    }
  },

  markRead: async (notificationId: number, userId: number): Promise<void> => {
    try {
      const sdb = await getSqliteDB();
      await sdb.run(
        'INSERT OR IGNORE INTO notification_reads (notificationId, userId) VALUES (?, ?)',
        [notificationId, userId]
      );
    } catch (err) {
      logger.warn('Error marking notification read in SQLite:', err);
    }
  },

  markAllRead: async (userId: number, role: string, section?: string): Promise<void> => {
    try {
      const notifs = await notificationRepository.findForUser(userId, role, section);
      for (const n of notifs) {
        if (n.id) {
          await notificationRepository.markRead(n.id, userId);
        }
      }
    } catch (err) {
      logger.warn('Error marking all notifications read in SQLite:', err);
    }
  },

  // Get audit read analytics for HOD/Faculty (e.g. 275 read, 25 unread)
  getReadStatusStats: async (notificationId: number): Promise<{ totalTarget: number; readCount: number; unreadCount: number }> => {
    try {
      const sdb = await getSqliteDB();
      const notif = await sdb.get<INotification>('SELECT targetSection, targetRole FROM notifications WHERE id = ?', [notificationId]);
      if (!notif) return { totalTarget: 0, readCount: 0, unreadCount: 0 };

      let totalSql = 'SELECT COUNT(*) as count FROM students WHERE isActive = 1';
      let readSql = `
        SELECT COUNT(DISTINCT nr.userId) as count 
        FROM notification_reads nr
        JOIN students s ON nr.userId = s.userId
        WHERE nr.notificationId = ? AND s.isActive = 1
      `;
      const totalParams: any[] = [];
      const readParams: any[] = [notificationId];

      if (notif.targetSection) {
        totalSql += ' AND section = ?';
        readSql += ' AND s.section = ?';
        totalParams.push(notif.targetSection);
        readParams.push(notif.targetSection);
      }

      const totalRes = await sdb.get<{ count: number }>(totalSql, totalParams);
      const readRes = await sdb.get<{ count: number }>(readSql, readParams);

      const totalTarget = totalRes?.count || 0;
      const readCount = readRes?.count || 0;
      const unreadCount = Math.max(0, totalTarget - readCount);

      return {
        totalTarget,
        readCount,
        unreadCount,
      };
    } catch (err) {
      return { totalTarget: 0, readCount: 0, unreadCount: 0 };
    }
  },
};
