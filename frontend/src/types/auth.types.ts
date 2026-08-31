export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface User {
  _id: string;
  id?: string;
  username: string;
  email: string;
  role: "admin" | "faculty" | "student";
  isActive: boolean;
  createdAt: string;
  profile?: { _id?: string };
}

export interface AuthResponse {
  token: string;
  user: User;
}
