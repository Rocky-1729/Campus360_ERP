import * as db from '../config/database';
import { IAnalyticsCache } from '../interfaces/db.interface';

export const cacheRepository = {
  setCache: async (facultyId: number | null, data: any): Promise<void> => {
    const jsonStr = JSON.stringify(data);
    await db.run(
      `INSERT OR REPLACE INTO analytics_cache (facultyId, jsonData, updatedAt)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [facultyId, jsonStr]
    );
  },

  getCache: async <T = any>(facultyId: number | null): Promise<T | null> => {
    let sql = 'SELECT jsonData FROM analytics_cache WHERE facultyId IS NULL';
    const params: any[] = [];
    if (facultyId !== null) {
      sql = 'SELECT jsonData FROM analytics_cache WHERE facultyId = ?';
      params.push(facultyId);
    }
    const cache = await db.get<{ jsonData: string }>(sql, params);
    if (!cache) return null;
    try {
      return JSON.parse(cache.jsonData) as T;
    } catch {
      return null;
    }
  },

  clearCache: async (facultyId: number | null): Promise<void> => {
    let sql = 'DELETE FROM analytics_cache WHERE facultyId IS NULL';
    const params: any[] = [];
    if (facultyId !== null) {
      sql = 'DELETE FROM analytics_cache WHERE facultyId = ?';
      params.push(facultyId);
    }
    await db.run(sql, params);
  },

  clearAll: async (): Promise<void> => {
    await db.run('DELETE FROM analytics_cache');
  },
};
