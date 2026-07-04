import * as db from '../config/database';
import { IUser } from '../interfaces/db.interface';

export const userRepository = {
  findById: async (id: number): Promise<IUser | undefined> => {
    return db.get<IUser>('SELECT * FROM users WHERE id = ? AND isActive = 1', [id]);
  },

  findByUsernameOrEmail: async (identifier: string): Promise<IUser | undefined> => {
    const val = identifier.toLowerCase().trim();
    return db.get<IUser>(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND isActive = 1',
      [val, val]
    );
  },

  create: async (user: IUser): Promise<number> => {
    const res = await db.run(
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
  },

  update: async (id: number, user: Partial<IUser>): Promise<void> => {
    const fields: string[] = [];
    const params: any[] = [];

    if (user.username !== undefined) {
      fields.push('username = ?');
      params.push(user.username.toLowerCase().trim());
    }
    if (user.email !== undefined) {
      fields.push('email = ?');
      params.push(user.email ? user.email.toLowerCase().trim() : null);
    }
    if (user.password !== undefined) {
      fields.push('password = ?');
      params.push(user.password);
    }
    if (user.role !== undefined) {
      fields.push('role = ?');
      params.push(user.role);
    }
    if (user.isActive !== undefined) {
      fields.push('isActive = ?');
      params.push(user.isActive);
    }

    if (fields.length === 0) return;

    fields.push('updatedAt = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  softDelete: async (id: number): Promise<void> => {
    await db.run('UPDATE users SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  },
};
