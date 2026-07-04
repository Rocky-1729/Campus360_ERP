export interface Achievement {
  _id: string;
  hallTicketNumber: string;
  studentName?: string;
  category: string;
  title: string;
  description: string;
  date: string;
  documentUrl: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  remarks: string;
  approvedBy: string;
  createdAt: string;
}

export interface CreateAchievementInput {
  category: string;
  title: string;
  description: string;
  date: string;
}
