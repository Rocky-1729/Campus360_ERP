export interface Faculty {
  _id: string;
  userId: string;
  facultyId: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  qualification: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateFacultyInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  designation: string;
  qualification: string;
}

export interface UpdateFacultyInput {
  name?: string;
  phone?: string;
  designation?: string;
  qualification?: string;
}
