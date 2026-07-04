import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import { ApiError } from '../utils/ApiError';

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
 * Attaches decoded user info ({ id, role }) to req.user.
 */
export const authenticate = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
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
