import * as db from '../config/database';
import { getSqliteDB } from '../config/sqliteDatabase';
import { IUser } from '../interfaces/db.interface';

const PG_SELECT_FIELDS = `
  id,
  username,
  email,
  password_hash AS password,
  role,
  student_id,
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export const userRepository = {
  findById: async (id: number): Promise<IUser | undefined> => {
    try {
      const row = await db.get<IUser>(
        `SELECT ${PG_SELECT_FIELDS} FROM users WHERE id = ?`,
        [id]
      );
      if (row) {
        return {
          ...row,
          isActive: row.isActive ? 1 : 0,
        };
      }
    } catch (err: any) {
      // If error occurs, attempt fallback
    }

    // Fallback to legacy SQLite database
    try {
      const sdb = await getSqliteDB();
      return await sdb.get<IUser>('SELECT * FROM users WHERE id = ?', [id]);
    } catch {
      return undefined;
    }
  },

  findByUsernameOrEmail: async (identifier: string): Promise<IUser | undefined> => {
    const val = identifier.toLowerCase().trim();
    try {
      const row = await db.get<IUser>(
        `SELECT ${PG_SELECT_FIELDS} 
         FROM users 
         WHERE (LOWER(username) = ? OR LOWER(email) = ?)`,
        [val, val]
      );
      if (row) {
        return {
          ...row,
          isActive: row.isActive ? 1 : 0,
        };
      }
    } catch (err: any) {
      // If error occurs, attempt fallback
    }

    // Fallback to legacy SQLite database
    try {
      const sdb = await getSqliteDB();
      return await sdb.get<IUser>(
        'SELECT * FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?)',
        [val, val]
      );
    } catch {
      return undefined;
    }
  },

  create: async (user: IUser): Promise<number> => {
    try {
      const res = await db.run(
        `INSERT INTO users (username, email, password_hash, role, is_active) 
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
        [
          user.username.toLowerCase().trim(),
          user.email ? user.email.toLowerCase().trim() : null,
          user.password,
          user.role,
          user.isActive !== 0,
        ]
      );
      const insertedId = res.rows && res.rows[0]?.id ? Number(res.rows[0].id) : res.lastID;
      return insertedId!;
    } catch (err: any) {
      const sdb = await getSqliteDB();
      const res = await sdb.run(
        'INSERT INTO users (username, email, password, role, isActive) VALUES (?, ?, ?, ?, ?)',
        [
          user.username.toLowerCase().trim(),
          user.email ? user.email.toLowerCase().trim() : null,
          user.password,
          user.role,
          user.isActive ?? 1,
        ]
      );
      return res.lastID!;
    }
  },

  update: async (id: number, user: Partial<IUser>): Promise<void> => {
    const pgFields: string[] = [];
    const pgParams: any[] = [];

    if (user.username !== undefined) {
      pgFields.push('username = ?');
      pgParams.push(user.username.toLowerCase().trim());
    }
    if (user.email !== undefined) {
      pgFields.push('email = ?');
      pgParams.push(user.email ? user.email.toLowerCase().trim() : null);
    }
    if (user.password !== undefined) {
      pgFields.push('password_hash = ?');
      pgParams.push(user.password);
    }
    if (user.role !== undefined) {
      pgFields.push('role = ?');
      pgParams.push(user.role);
    }
    if (user.isActive !== undefined) {
      pgFields.push('is_active = ?');
      pgParams.push(user.isActive !== 0);
    }

    if (pgFields.length === 0) return;

    pgFields.push('updated_at = CURRENT_TIMESTAMP');
    pgParams.push(id);

    try {
      await db.run(`UPDATE users SET ${pgFields.join(', ')} WHERE id = ?`, pgParams);
    } catch (err: any) {
      // Fallback update
      const sdb = await getSqliteDB();
      const sqliteFields: string[] = [];
      const sqliteParams: any[] = [];
      if (user.username !== undefined) { sqliteFields.push('username = ?'); sqliteParams.push(user.username.toLowerCase().trim()); }
      if (user.email !== undefined) { sqliteFields.push('email = ?'); sqliteParams.push(user.email ? user.email.toLowerCase().trim() : null); }
      if (user.password !== undefined) { sqliteFields.push('password = ?'); sqliteParams.push(user.password); }
      if (user.role !== undefined) { sqliteFields.push('role = ?'); sqliteParams.push(user.role); }
      if (user.isActive !== undefined) { sqliteFields.push('isActive = ?'); sqliteParams.push(user.isActive); }
      sqliteFields.push('updatedAt = CURRENT_TIMESTAMP');
      sqliteParams.push(id);
      await sdb.run(`UPDATE users SET ${sqliteFields.join(', ')} WHERE id = ?`, sqliteParams);
    }
  },

  softDelete: async (id: number): Promise<void> => {
    try {
      await db.run('UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    } catch (err: any) {
      const sdb = await getSqliteDB();
      await sdb.run('UPDATE users SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    }
  },
};


