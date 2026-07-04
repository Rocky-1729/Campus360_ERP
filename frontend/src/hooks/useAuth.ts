import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth.api';
import type { LoginCredentials } from '../types';

export function useAuth() {
  const { user, token, isAuthenticated, isLoading, setAuth, logout, setLoading } = useAuthStore();
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (response) => {
      const { token: authToken, user: authUser } = response.data;
      setAuth(authUser, authToken);
      toast.success(`Welcome back!`);

      const redirectMap: Record<string, string> = {
        admin: '/admin/dashboard',
        faculty: '/faculty/dashboard',
        student: '/student/dashboard',
      };
      navigate(redirectMap[authUser.role] || '/login');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Login failed');
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const validateSession = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await authApi.getMe();
      setAuth(response.data, token);
    } catch {
      logout();
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutate,
    loginLoading: loginMutation.isPending,
    logout: handleLogout,
    validateSession,
  };
}
