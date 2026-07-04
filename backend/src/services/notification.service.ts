import { notificationRepository } from '../repositories/notification.repository';
import { studentRepository } from '../repositories/student.repository';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { INotification } from '../interfaces/db.interface';

/** Input for creating a notification */
interface CreateNotificationInput {
  senderId: string;
  senderName?: string;
  type: string;
  title: string;
  message: string;
  targetRole?: 'all' | 'faculty' | 'student';
  targetSection?: string;
}

/**
 * Create a new notification.
 * @param data - Notification data
 * @returns Created notification document
 */
export const createNotification = async (
  data: CreateNotificationInput
): Promise<INotification> => {
  try {
    const notifId = await notificationRepository.create({
      senderId: Number(data.senderId),
      senderName: data.senderName || 'CSE Department',
      type: data.type,
      title: data.title,
      message: data.message,
      targetRole: data.targetRole || 'all',
      targetSection: data.targetSection || '',
    });

    logger.info(`Notification created: ${data.title}`);
    return { id: notifId, ...data, senderId: Number(data.senderId) } as any;
  } catch (error) {
    logger.error('Create notification error:', error);
    throw ApiError.internal('An error occurred while creating notification.');
  }
};

/**
 * Get notifications for a user based on role and section.
 * Admin sees all. Faculty sees 'all' and 'faculty' targeted.
 * Student sees 'all' and 'student' targeted, filtered by section.
 * @param userId - Authenticated user's ID
 * @param role - User's role
 * @returns Array of notification documents
 */
export const getNotifications = async (
  userId: string,
  role: string
): Promise<any[]> => {
  try {
    let section = '';
    if (role === 'student') {
      const student = await studentRepository.findByUserId(Number(userId));
      section = student?.section || '';
    }

    const notifs = await notificationRepository.findForUser(Number(userId), role, section);

    // Map rows to match expected schema outputs
    return notifs.map((n) => ({
      _id: String(n.id),
      senderId: String(n.senderId),
      senderName: n.senderName,
      type: n.type,
      title: n.title,
      message: n.message,
      targetRole: n.targetRole,
      targetSection: n.targetSection,
      readBy: n.isRead ? [Number(userId)] : [], // Mock readBy format for frontend checks
      createdAt: n.createdAt,
    }));
  } catch (error) {
    logger.error('Get notifications error:', error);
    throw ApiError.internal('An error occurred while fetching notifications.');
  }
};

/**
 * Mark a single notification as read by a user.
 * @param notificationId - Notification ID
 * @param userId - User ID to add to readBy list
 */
export const markAsRead = async (
  notificationId: string,
  userId: string
): Promise<any> => {
  try {
    await notificationRepository.markRead(Number(notificationId), Number(userId));
    return { message: 'Notification marked as read.' };
  } catch (error) {
    logger.error('Mark as read error:', error);
    throw ApiError.internal('An error occurred while marking notification as read.');
  }
};

/**
 * Mark all notifications as read for a user.
 * @param userId - User ID to mark all reads for
 * @param role - User role
 */
export const markAllAsRead = async (userId: string, role?: string): Promise<void> => {
  try {
    let section = '';
    // Role is optional, detect it if not passed
    let userRole = role || 'student';

    if (userRole === 'student') {
      const student = await studentRepository.findByUserId(Number(userId));
      section = student?.section || '';
    }

    await notificationRepository.markAllRead(Number(userId), userRole, section);
  } catch (error) {
    logger.error('Mark all as read error:', error);
    throw ApiError.internal('An error occurred while marking all notifications as read.');
  }
};
