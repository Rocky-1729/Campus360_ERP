import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';

/**
 * Handle user login.
 */
export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const identifier = req.body.identifier || req.body.username;
    const { password } = req.body;
    if (!identifier || !password) {
      throw ApiError.badRequest('Username/ID and password are required.');
    }
    const result = await authService.login(identifier, password);
    res.status(200).json(ApiResponse.success(result, 'Login successful.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile.
 */
export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const profile = await authService.getProfile(req.user.id);
    res.status(200).json(ApiResponse.success(profile, 'Profile fetched successfully.'));
  } catch (error) {
    next(error);
  }
};
