import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { ApiError } from '../utils/ApiError';

/**
 * Role-based authorization middleware factory.
 * Returns middleware that checks if the authenticated user's role
 * is included in the list of allowed roles.
 *
 * @param roles - One or more allowed roles
 * @returns Express middleware function
 *
 * @example
 * router.get('/admin-only', authenticate, authorize('admin'), handler);
 * router.get('/staff', authenticate, authorize('admin', 'faculty'), handler);
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required.'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(
        ApiError.forbidden(
          `Role '${req.user.role}' is not authorized to access this resource.`
        )
      );
      return;
    }

    next();
  };
};
