import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Zod schema for environment variable validation.
 * Ensures all required variables are present and correctly typed.
 */
const envSchema = z.object({
  PORT: z.string().default('5000'),
  SQLITE_DB_PATH: z.string().default('campus360.db'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DEFAULT_ADMIN_EMAIL: z.string().email('DEFAULT_ADMIN_EMAIL must be a valid email'),
  DEFAULT_ADMIN_PASSWORD: z.string().min(6, 'DEFAULT_ADMIN_PASSWORD must be at least 6 characters'),
  // PostgreSQL Database Configuration
  DATABASE_URL: z.string().optional(),
  PGHOST: z.string().optional(),
  PGPORT: z.string().optional().default('5432'),
  PGUSER: z.string().optional(),
  PGPASSWORD: z.string().optional(),
  PGDATABASE: z.string().optional(),
  PG_MAX_POOL: z.string().optional().default('20'),
  PG_IDLE_TIMEOUT_MS: z.string().optional().default('30000'),
});

/** Inferred TypeScript type from the Zod env schema */
export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/** Validated and typed environment configuration object */
export const env: EnvConfig = parsed.data;
