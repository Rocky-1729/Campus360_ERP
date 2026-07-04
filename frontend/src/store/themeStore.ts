import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: (() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('campus360_theme');
    if (stored !== null) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  })(),

  toggleTheme: () => {
    set((state) => {
      const newDark = !state.isDark;
      localStorage.setItem('campus360_theme', newDark ? 'dark' : 'light');
      if (newDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { isDark: newDark };
    });
  },

  setTheme: (isDark: boolean) => {
    localStorage.setItem('campus360_theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ isDark });
  },
}));

// Initialize theme on load
const initTheme = () => {
  const stored = localStorage.getItem('campus360_theme');
  const isDark = stored !== null
    ? stored === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDark) {
    document.documentElement.classList.add('dark');
  }
};

initTheme();
