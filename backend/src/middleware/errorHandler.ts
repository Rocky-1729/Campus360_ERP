import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { errorRepository } from '../repositories/error.repository';

/** Shape of error response body */
interface ErrorResponseBody {
  success: false;
  message: string;
  errors: string[];
}

/**
 * Global error handler middleware.
 * Must be the LAST middleware registered on the Express app.
 *
 * Handles:
 * - ApiError instances (custom app errors)
 * - SQLite errors / generic database constraints
 * - JWT errors (JsonWebTokenError, TokenExpiredError)
 * - All other unknown errors (500)
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: string[] = [];

  // Custom ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  }
  // SQLite Constraint / unique errors
  else if (err.message && (err.message.includes('UNIQUE constraint failed') || (err as any).code === 'SQLITE_CONSTRAINT')) {
    statusCode = 409;
    message = `Database constraint violation: ${err.message}`;
  }
  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired';
  }
  // Unknown error
  else {
    message = err.message || 'Internal server error';
  }

  logger.error(`[${statusCode}] ${message}`, errors.length > 0 ? errors : '');

  // Log 500 internal errors to error_logs table in SQLite
  if (statusCode === 500) {
    errorRepository.log(req.originalUrl || req.url || 'API', err).catch((dbErr) => {
      logger.error('Failed to log API error to SQLite:', dbErr);
    });
  }

  const body: ErrorResponseBody = {
    success: false,
    message,
    errors,
  };

  res.status(statusCode).json(body);
};
