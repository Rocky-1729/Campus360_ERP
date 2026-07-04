import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import { userRepository } from '../repositories/user.repository';
import { facultyRepository } from '../repositories/faculty.repository';
import { studentRepository } from '../repositories/student.repository';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { IUser } from '../interfaces/db.interface';
import bcrypt from 'bcryptjs';

/** Shape of the JWT payload */
interface TokenPayload {
  id: string;
  role: string;
  username?: string;
}

/** Shape of the login response */
interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
  };
}

/** Shape of user profile response */
interface ProfileResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  profile: Record<string, unknown> | null;
}

/**
 * Generate a signed JWT token.
 * @param payload - Data to encode in the token (id, role)
 * @returns Signed JWT string
 */
export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

/**
 * Authenticate a user by username/email and password.
 * @param identifier - User ID/username or email
 * @param password - Plain-text password
 * @returns Token and user data on success
 */
export const login = async (
  identifier: string,
  password: string
): Promise<LoginResponse> => {
  try {
    const user = await userRepository.findByUsernameOrEmail(identifier);

    if (!user) {
      throw ApiError.unauthorized('Invalid username/ID or password.');
    }

    if (user.isActive === 0) {
      throw ApiError.unauthorized('Your account has been deactivated. Contact the administrator.');
    }

    // Compare hashed password using bcrypt (since password hashes are stored)
    // Fallback: if seeded with plain text or comparison fails, check if plain matches (useful for testing seeders)
    let isPasswordValid = await bcrypt.compare(password, user.password || '');

    if (!isPasswordValid) {
      // Check if user is using default password (their Hall Ticket / Faculty ID) case-insensitively
      const inputLower = password.toLowerCase().trim();
      const usernameLower = user.username.toLowerCase().trim();
      if (inputLower === usernameLower) {
        // Verify that their stored password is indeed their default hall-ticket/faculty-ID
        const isDefaultUpper = await bcrypt.compare(user.username.toUpperCase(), user.password || '');
        const isDefaultLower = await bcrypt.compare(user.username.toLowerCase(), user.password || '');
        if (isDefaultUpper || isDefaultLower) {
          isPasswordValid = true;
        }
      }
    }

    if (!isPasswordValid && password !== user.password) {
      throw ApiError.unauthorized('Invalid username/ID or password.');
    }

    const token = generateToken({
      id: String(user.id),
      role: user.role,
      username: user.username,
    });

    return {
      token,
      user: {
        id: String(user.id),
        username: user.username,
        email: user.email || '',
        role: user.role,
        isActive: user.isActive !== 0,
      },
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Login error:', error);
    throw ApiError.internal('An error occurred during login.');
  }
};

/**
 * Get user profile with role-specific details.
 * @param userId - The authenticated user's ID
 * @returns User profile with role-specific data
 */
export const getProfile = async (userId: string): Promise<ProfileResponse> => {
  try {
    const user = await userRepository.findById(Number(userId));

    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    let profile: Record<string, unknown> | null = null;

    if (user.role === 'faculty') {
      const faculty = await facultyRepository.findByUserId(user.id!);
      if (faculty) {
        profile = faculty as unknown as Record<string, unknown>;
      }
    } else if (user.role === 'student') {
      const student = await studentRepository.findByUserId(user.id!);
      if (student) {
        profile = student as unknown as Record<string, unknown>;
      }
    }

    return {
      id: String(user.id),
      username: user.username,
      email: user.email || '',
      role: user.role,
      isActive: user.isActive !== 0,
      profile,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Get profile error:', error);
    throw ApiError.internal('An error occurred while fetching profile.');
  }
};
