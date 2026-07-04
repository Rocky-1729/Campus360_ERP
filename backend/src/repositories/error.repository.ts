import * as db from '../config/database';
import { IErrorLog } from '../interfaces/db.interface';

export const errorRepository = {
  log: async (api: string, err: Error): Promise<number> => {
    const res = await db.run(
      'INSERT INTO error_logs (api, error, stack) VALUES (?, ?, ?)',
      [api, err.message || String(err), err.stack || '']
    );
    return res.lastID!;
  },
};
