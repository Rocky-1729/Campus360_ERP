export interface Certificate {
  _id: string;
  hallTicketNumber: string;
  studentName?: string;
  type: string;
  title: string;
  issuingOrganization: string;
  issueDate: string;
  certificateUrl: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  remarks: string;
  approvedBy: string;
  createdAt: string;
}

export interface CreateCertificateInput {
  type: string;
  title: string;
  issuingOrganization: string;
  issueDate: string;
}
