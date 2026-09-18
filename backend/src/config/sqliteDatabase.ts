import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let sqliteDbInstance: Database | null = null;

/**
 * Provides access to the legacy SQLite database (campus360.db)
 * for user authentication and legacy records during the migration phase.
 */
export const getSqliteDB = async (): Promise<Database> => {
  if (!sqliteDbInstance) {
    const dbPath = path.resolve(__dirname, '../database/campus360.db');
    sqliteDbInstance = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  }
  return sqliteDbInstance;
};

/**
 * Close SQLite database connection if open.
 */
export const closeSqliteDB = async (): Promise<void> => {
  if (sqliteDbInstance) {
    await sqliteDbInstance.close();
    sqliteDbInstance = null;
  }
};
