import { api } from './axios';
import type {
  ApiResponse,
  Notification,
  CreateNotificationInput,
} from '../types';

export const notificationApi = {
  createNotification: (data: CreateNotificationInput) =>
    api.post<unknown, ApiResponse<Notification>>('/notifications', data),

  getNotifications: () =>
    api.get<unknown, ApiResponse<Notification[]>>('/notifications'),

  markAsRead: (id: string) =>
    api.patch<unknown, ApiResponse<Notification>>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.patch<unknown, ApiResponse<null>>('/notifications/read-all'),
};
