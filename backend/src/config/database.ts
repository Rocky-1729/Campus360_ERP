import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { env } from './environment';
import { logger } from '../utils/logger';

let dbInstance: Database | null = null;
const dbFilePath = path.isAbsolute(env.SQLITE_DB_PATH)
  ? env.SQLITE_DB_PATH
  : path.join(__dirname, '..', 'database', env.SQLITE_DB_PATH);

/**
 * Initialize the SQLite database.
 * Connects to the database file, enables foreign keys, and runs migrations from schema.sql.
 */
export const connectDB = async (): Promise<Database> => {
  try {
    // Ensure parent directories exist
    const dbDir = path.dirname(dbFilePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    logger.info(`Opening SQLite database at: ${dbFilePath}`);

    dbInstance = await open({
      filename: dbFilePath,
      driver: sqlite3.Database,
    });

    // Enable foreign keys
    await dbInstance.run('PRAGMA foreign_keys = ON;');
    logger.info('SQLite database connected successfully.');

    // Run migrations from schema.sql
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      logger.info('Executing database migrations from schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await dbInstance.exec(schemaSql);
      logger.info('Database schema migrations completed successfully.');
    } else {
      logger.warn(`Migrations schema.sql not found at: ${schemaPath}`);
    }

    // Seed default semesters configuration if empty
    const semesterCount = await dbInstance.get<{ count: number }>('SELECT COUNT(*) as count FROM semesters');
    if (semesterCount && semesterCount.count === 0) {
      logger.info('Seeding default semester configurations...');
      const sems = [
        { code: '1-1', name: 'I Year I Semester' },
        { code: '1-2', name: 'I Year II Semester' },
        { code: '2-1', name: 'II Year I Semester' },
        { code: '2-2', name: 'II Year II Semester' },
        { code: '3-1', name: 'III Year I Semester' },
        { code: '3-2', name: 'III Year II Semester' },
        { code: '4-1', name: 'IV Year I Semester' },
        { code: '4-2', name: 'IV Year II Semester' },
      ];
      for (const sem of sems) {
        await dbInstance.run('INSERT INTO semesters (code, name) VALUES (?, ?)', [sem.code, sem.name]);
      }
      logger.info('Semesters seeded.');
    }

    return dbInstance;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to initialize SQLite Database: ${message}`);
    process.exit(1);
  }
};

/**
 * Close the current database connection.
 */
export const closeDB = async (): Promise<void> => {
  if (dbInstance) {
    try {
      await dbInstance.close();
      dbInstance = null;
      logger.info('SQLite database connection closed.');
    } catch (error) {
      logger.error('Failed to close SQLite connection:', error);
    }
  }
};

/**
 * Get the active database instance.
 */
export const getDB = (): Database => {
  if (!dbInstance) {
    throw new Error('Database connection has not been initialized.');
  }
  return dbInstance;
};

/**
 * Query runner helper: fetches all rows matching statement.
 */
export const all = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  return getDB().all<T[]>(sql, params);
};

/**
 * Query runner helper: fetches single row matching statement.
 */
export const get = async <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return getDB().get<T>(sql, params);
};

/**
 * Query runner helper: executes insert/update/delete statement.
 */
export const run = async (sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> => {
  return getDB().run(sql, params);
};

/**
 * Query runner helper: executes multiple raw SQL statements.
 */
export const exec = async (sql: string): Promise<void> => {
  return getDB().exec(sql);
};

/**
 * Returns the absolute database file path.
 */
export const getDBPath = (): string => {
  return dbFilePath;
};
