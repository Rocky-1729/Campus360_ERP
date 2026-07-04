import { achievementRepository } from '../repositories/achievement.repository';
import { cloudinary } from '../config/cloudinary';
import * as db from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { IAchievement } from '../interfaces/db.interface';

/** Input for creating an achievement */
interface CreateAchievementInput {
  hallTicketNumber: string;
  category: string;
  title: string;
  description?: string;
  date?: string;
}

/** Filter for pending achievements */
interface PendingFilter {
  hallTicketNumbers?: string[];
  category?: string;
}

/**
 * Upload a document to Cloudinary and create an Achievement record.
 * @param data - Achievement metadata
 * @param file - Optional Multer file buffer
 * @returns Created Achievement document
 */
export const createAchievement = async (
  data: CreateAchievementInput,
  file?: Express.Multer.File
): Promise<IAchievement> => {
  try {
    let documentUrl = '';

    if (file) {
      const base64 = file.buffer.toString('base64');
      const dataUri = `data:${file.mimetype};base64,${base64}`;

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: 'campus360/achievements',
        resource_type: 'auto',
      });

      documentUrl = uploadResult.secure_url;
    }

    const achId = await achievementRepository.create({
      hallTicketNumber: data.hallTicketNumber.toUpperCase(),
      category: data.category,
      title: data.title,
      description: data.description || '',
      date: data.date || '',
      documentUrl,
    });

    const achievement = await achievementRepository.findById(achId);
    return achievement!;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Create achievement error:', error);
    throw ApiError.internal('An error occurred while creating achievement.');
  }
};

/**
 * Approve or reject an achievement.
 */
export const updateAchievementStatus = async (
  id: string,
  status: 'approved' | 'rejected',
  remarks: string,
  approvedBy: string
): Promise<IAchievement> => {
  try {
    const achievement = await achievementRepository.findById(Number(id));
    if (!achievement) {
      throw ApiError.notFound('Achievement not found.');
    }

    await achievementRepository.updateStatus(Number(id), status, remarks);
    const updated = await achievementRepository.findById(Number(id));
    return updated!;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Update achievement status error:', error);
    throw ApiError.internal('An error occurred while updating achievement.');
  }
};

/**
 * Get all achievements for a student.
 */
export const getAchievementsByHallTicket = async (
  hallTicket: string
): Promise<IAchievement[]> => {
  try {
    return achievementRepository.findByStudent(hallTicket);
  } catch (error) {
    logger.error('Get achievements error:', error);
    throw ApiError.internal('An error occurred while fetching achievements.');
  }
};

/**
 * Get pending achievements for review, optionally scoped to specific students.
 */
export const getPendingAchievements = async (
  filter: PendingFilter
): Promise<IAchievement[]> => {
  try {
    let sql = "SELECT * FROM achievements WHERE status = 'pending'";
    const params: any[] = [];

    if (filter.hallTicketNumbers && filter.hallTicketNumbers.length > 0) {
      const placeholders = filter.hallTicketNumbers.map(() => '?').join(',');
      sql += ` AND UPPER(hallTicketNumber) IN (${placeholders})`;
      filter.hallTicketNumbers.forEach((ht) => params.push(ht.toUpperCase()));
    }

    if (filter.category) {
      sql += ' AND category = ?';
      params.push(filter.category);
    }

    sql += ' ORDER BY createdAt DESC';
    return db.all<IAchievement>(sql, params);
  } catch (error) {
    logger.error('Get pending achievements error:', error);
    throw ApiError.internal('An error occurred while fetching pending achievements.');
  }
};
