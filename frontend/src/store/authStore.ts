import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user: User, token: string) => {
    localStorage.setItem('campus360_token', token);
    localStorage.setItem('campus360_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('campus360_token');
    localStorage.removeItem('campus360_user');
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  hydrate: () => {
    const token = localStorage.getItem('campus360_token');
    const userStr = localStorage.getItem('campus360_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ user, token, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem('campus360_token');
        localStorage.removeItem('campus360_user');
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));
