import { api } from './axios';
import type { LoginCredentials, AuthResponse, User, ApiResponse } from '../types';

export const authApi = {
  login: (credentials: LoginCredentials) =>
    api.post<unknown, ApiResponse<AuthResponse>>('/auth/login', credentials),

  getMe: () =>
    api.get<unknown, ApiResponse<User>>('/auth/me'),
};
