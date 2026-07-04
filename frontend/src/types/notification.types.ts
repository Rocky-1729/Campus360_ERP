export interface Notification {
  _id: string;
  senderId: string;
  senderName: string;
  type: 'info' | 'warning' | 'urgent' | 'announcement';
  title: string;
  message: string;
  targetRole: 'all' | 'faculty' | 'student';
  targetSection?: string;
  readBy: string[];
  createdAt: string;
}

export interface CreateNotificationInput {
  type: 'info' | 'warning' | 'urgent' | 'announcement';
  title: string;
  message: string;
  targetRole: 'all' | 'faculty' | 'student';
  targetSection?: string;
}
