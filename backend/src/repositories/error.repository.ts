import { getSqliteDB } from '../config/sqliteDatabase';

export const errorRepository = {
  log: async (api: string, err: Error): Promise<number> => {
    try {
      const sdb = await getSqliteDB();
      const res = await sdb.run(
        'INSERT INTO error_logs (api, error, stack) VALUES (?, ?, ?)',
        [api, err.message || String(err), err.stack || '']
      );
      return res.lastID ?? 0;
    } catch {
      return 0;
    }
  },
};
