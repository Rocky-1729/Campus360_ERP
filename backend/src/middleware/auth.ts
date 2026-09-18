import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import { ApiError } from '../utils/ApiError';
import * as db from '../config/database';

/** JWT token payload shape */
export interface JwtPayload {
  id: string;
  role: 'admin' | 'faculty' | 'student';
  username?: string;
}

/** Extended Express Request with authenticated user info */
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Authentication middleware.
 * Extracts and verifies a JWT Bearer token from the Authorization header.
 * Validates active account status against PostgreSQL users table.
 * Attaches decoded user info ({ id, role, username }) to req.user.
 */
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access denied. No token provided.');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw ApiError.unauthorized('Access denied. No token provided.');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Live account status verification (Step 16: Account Deactivation Guard)
    if (decoded.id && !isNaN(Number(decoded.id))) {
      try {
        const userRow = await db.get<{ is_active: boolean }>(
          'SELECT is_active FROM users WHERE id = ?',
          [Number(decoded.id)]
        );
        if (userRow && !userRow.is_active) {
          throw ApiError.unauthorized('Account has been deactivated. Contact the administrator.');
        }
      } catch (checkErr) {
        if (checkErr instanceof ApiError) throw checkErr;
        // Fallback gracefully if database check experiences transient issue
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    next(ApiError.unauthorized('Invalid or expired token.'));
  }
};

