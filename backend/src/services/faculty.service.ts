import { userRepository } from '../repositories/user.repository';
import { facultyRepository } from '../repositories/faculty.repository';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { IFaculty } from '../interfaces/db.interface';
import bcrypt from 'bcryptjs';

/** Shape of the create faculty input */
interface CreateFacultyInput {
  facultyId: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  qualification?: string;
  password?: string;
}

/** Shape of the update faculty input */
interface UpdateFacultyInput {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
  qualification?: string;
}

/** Faculty with assignment count */
interface FacultyWithCount {
  faculty: IFaculty;
  assignmentCount: number;
}

/**
 * Create a new faculty member.
 * @param data - Faculty creation data
 * @returns The created Faculty document
 */
export const createFaculty = async (data: CreateFacultyInput): Promise<IFaculty> => {
  try {
    const searchEmail = data.email.toLowerCase().trim();
    const searchId = data.facultyId.toLowerCase().trim();

    // Check if faculty with this email or Faculty ID already exists
    const existingUser = await userRepository.findByUsernameOrEmail(searchEmail);
    if (existingUser) {
      throw ApiError.badRequest('A user with this email already exists.');
    }

    const existingFaculty = await facultyRepository.findByFacultyId(data.facultyId);
    if (existingFaculty) {
      throw ApiError.badRequest('A faculty member with this ID already exists.');
    }

    // Default password is the facultyId itself
    const passwordRaw = data.password || data.facultyId.trim();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordRaw, salt);

    // Create user account in SQLite
    const userId = await userRepository.create({
      username: searchId,
      email: searchEmail,
      password: hashedPassword,
      role: 'faculty',
    });

    // Create faculty profile in SQLite
    const facultyId = await facultyRepository.create({
      userId,
      facultyId: data.facultyId,
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      designation: data.designation || '',
      qualification: data.qualification || '',
    });

    const faculty = await facultyRepository.findById(facultyId);
    return faculty!;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Create faculty error:', error);
    throw ApiError.internal('An error occurred while creating faculty.');
  }
};

/**
 * Update an existing faculty profile.
 * @param id - Faculty document ID
 * @param data - Fields to update
 * @returns Updated Faculty document
 */
export const updateFaculty = async (
  id: string,
  data: UpdateFacultyInput
): Promise<IFaculty> => {
  try {
    const faculty = await facultyRepository.findById(Number(id));
    if (!faculty) {
      throw ApiError.notFound('Faculty not found.');
    }

    await facultyRepository.update(Number(id), {
      name: data.name,
      email: data.email,
      phone: data.phone,
      designation: data.designation,
      qualification: data.qualification,
    });

    // If email changed, also update the User record
    if (data.email) {
      await userRepository.update(faculty.userId, {
        email: data.email.toLowerCase(),
      });
    }

    const updated = await facultyRepository.findById(Number(id));
    return updated!;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Update faculty error:', error);
    throw ApiError.internal('An error occurred while updating faculty.');
  }
};

/**
 * Toggle a faculty member's active status (Soft delete / Deactivate).
 * @param id - Faculty document ID
 * @returns The updated Faculty document and the new isActive status
 */
export const toggleFaculty = async (
  id: string
): Promise<{ faculty: IFaculty; isActive: boolean }> => {
  try {
    const faculty = await facultyRepository.findById(Number(id));
    if (!faculty) {
      throw ApiError.notFound('Faculty not found.');
    }

    const user = await userRepository.findById(faculty.userId);
    if (!user) {
      throw ApiError.notFound('Associated user account not found.');
    }

    const nextActive = user.isActive === 1 ? 0 : 1;
    await userRepository.update(user.id!, { isActive: nextActive });
    await facultyRepository.update(Number(id), { isActive: nextActive });

    const updatedFaculty = await facultyRepository.findById(Number(id));
    return { faculty: updatedFaculty!, isActive: nextActive === 1 };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Toggle faculty error:', error);
    throw ApiError.internal('An error occurred while toggling faculty status.');
  }
};

/**
 * Get all faculty members with their assignment counts.
 * @returns Array of faculty with assignment counts
 */
export const getAllFaculty = async (): Promise<FacultyWithCount[]> => {
  try {
    const facultyList = await facultyRepository.getAllFaculty();
    const result: FacultyWithCount[] = [];

    for (const faculty of facultyList) {
      const assignments = await facultyRepository.getAssignments({ facultyId: faculty.id });
      result.push({ faculty, assignmentCount: assignments.length });
    }

    return result;
  } catch (error) {
    logger.error('Get all faculty error:', error);
    throw ApiError.internal('An error occurred while fetching faculty list.');
  }
};

/**
 * Get a single faculty member by ID with their assignments.
 * @param id - Faculty document ID
 * @returns Faculty document with populated assignments
 */
export const getFacultyById = async (id: string): Promise<{
  faculty: IFaculty;
  assignments: unknown[];
}> => {
  try {
    const faculty = await facultyRepository.findById(Number(id));
    if (!faculty) {
      throw ApiError.notFound('Faculty not found.');
    }

    const assignments = await facultyRepository.getAssignments({ facultyId: faculty.id });
    return { faculty, assignments };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Get faculty by ID error:', error);
    throw ApiError.internal('An error occurred while fetching faculty.');
  }
};
