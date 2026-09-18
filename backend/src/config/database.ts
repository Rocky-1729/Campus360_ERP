import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { env } from './environment';
import { logger } from '../utils/logger';

let poolInstance: Pool | null = null;

/**
 * Derives PostgreSQL Pool configuration from environment variables.
 */
export const getPoolConfig = (): PoolConfig => {
  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      max: Number(env.PG_MAX_POOL || 20),
      idleTimeoutMillis: Number(env.PG_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: 10000,
    };
  }

  return {
    host: env.PGHOST || 'localhost',
    port: Number(env.PGPORT || 5432),
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
    max: Number(env.PG_MAX_POOL || 20),
    idleTimeoutMillis: Number(env.PG_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: 10000,
  };
};

/**
 * Initializes and connects the PostgreSQL connection pool.
 */
export const connectDB = async (): Promise<Pool> => {
  try {
    const config = getPoolConfig();

    if (!env.DATABASE_URL && (!config.host || !config.database || !config.user)) {
      logger.warn('PostgreSQL environment variables (PGUSER, PGDATABASE, etc. or DATABASE_URL) are not fully configured in .env');
    }

    poolInstance = new Pool(config);

    poolInstance.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client:', err);
    });

    // Verify connection by checking database and version
    const client = await poolInstance.connect();
    const result = await client.query('SELECT current_database(), current_user, version()');
    client.release();

    const dbName = result.rows[0].current_database;
    const dbUser = result.rows[0].current_user;
    logger.info(`PostgreSQL connected successfully to database "${dbName}" as user "${dbUser}".`);

    return poolInstance;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to initialize PostgreSQL Connection Pool: ${message}`);
    throw error;
  }
};

/**
 * Safely closes the active PostgreSQL connection pool.
 */
export const closeDB = async (): Promise<void> => {
  if (poolInstance) {
    try {
      await poolInstance.end();
      poolInstance = null;
      logger.info('PostgreSQL connection pool closed.');
    } catch (error) {
      logger.error('Failed to close PostgreSQL connection pool:', error);
    }
  }
};

/**
 * Returns the active PostgreSQL connection pool instance.
 */
export const getPool = (): Pool => {
  if (!poolInstance) {
    throw new Error('PostgreSQL database pool has not been initialized. Call connectDB() first.');
  }
  return poolInstance;
};

/**
 * Acquires a client from the connection pool.
 * Remember to release the client back to the pool when done: client.release().
 */
export const getClient = async (): Promise<PoolClient> => {
  const pool = getPool();
  return pool.connect();
};

/**
 * Primary query helper: executes a parameterized query against the connection pool.
 */
export const query = async <T extends QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> => {
  const pool = getPool();
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    logger.warn(`Slow query (${duration}ms): ${text.slice(0, 100)}...`);
  }
  return res;
};

/**
 * Helper to convert SQLite '?' placeholders to PostgreSQL '$1, $2, ...' placeholders
 */
const convertPlaceholders = (sql: string): string => {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
};

/**
 * Adapter helper: fetches all rows matching statement.
 */
export const all = async <T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<T[]> => {
  const pgSql = convertPlaceholders(sql);
  const result = await query<T>(pgSql, params);
  return result.rows;
};

/**
 * Adapter helper: fetches single row matching statement.
 */
export const get = async <T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  const pgSql = convertPlaceholders(sql);
  const result = await query<T>(pgSql, params);
  return result.rows[0];
};

/**
 * Adapter helper: executes insert/update/delete statement.
 */
export const run = async (
  sql: string,
  params: any[] = []
): Promise<{ lastID?: number; changes?: number; rows?: any[] }> => {
  const pgSql = convertPlaceholders(sql);
  const result = await query(pgSql, params);
  return {
    changes: result.rowCount ?? 0,
    rows: result.rows,
  };
};

/**
 * Adapter helper: executes raw SQL script.
 */
export const exec = async (sql: string): Promise<void> => {
  await query(sql);
};

export const getDBPath = (): string => {
  return env.DATABASE_URL || `${env.PGHOST || 'localhost'}:${env.PGPORT || 5432}/${env.PGDATABASE || ''}`;
};

