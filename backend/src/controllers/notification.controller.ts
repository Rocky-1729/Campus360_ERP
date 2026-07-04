import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as notificationService from '../services/notification.service';
import { facultyRepository } from '../repositories/faculty.repository';
import { studentRepository } from '../repositories/student.repository';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';

/**
 * Helper to fetch sender name
 */
const getSenderName = async (userId: string, role: string): Promise<string> => {
  if (role === 'admin') {
    return 'Department Admin';
  } else if (role === 'faculty') {
    const faculty = await facultyRepository.findByUserId(Number(userId));
    return faculty ? faculty.name : 'Faculty Member';
  } else if (role === 'student') {
    const student = await studentRepository.findByUserId(Number(userId));
    return student ? student.name : 'Student';
  }
  return 'System';
};

/**
 * Create and send a notification.
 */
export const create = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const { type, title, message, targetRole, targetSection } = req.body;
    if (!type || !title || !message) {
      throw ApiError.badRequest('Type, title, and message are required.');
    }

    const senderName = await getSenderName(req.user.id, req.user.role);

    const notification = await notificationService.createNotification({
      senderId: req.user.id,
      senderName,
      type,
      title,
      message,
      targetRole,
      targetSection,
    });

    res.status(201).json(ApiResponse.created(notification, 'Notification sent successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get all notifications for current user.
 */
export const getAll = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const notifications = await notificationService.getNotifications(req.user.id, req.user.role);
    res.status(200).json(ApiResponse.success(notifications, 'Notifications fetched successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read.
 */
export const markRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, req.user.id);
    res.status(200).json(ApiResponse.success(notification, 'Notification marked as read.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read.
 */
export const markAllRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    await notificationService.markAllAsRead(req.user.id, req.user.role);
    res.status(200).json(ApiResponse.success(null, 'All notifications marked as read.'));
  } catch (error) {
    next(error);
  }
};
