import { Toaster } from 'react-hot-toast';
import { useThemeStore } from '../../store/themeStore';

export function ToastProvider() {
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: isDark ? '#1E293B' : '#FFFFFF',
          color: isDark ? '#F1F5F9' : '#0F172A',
          border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          borderRadius: '0.75rem',
          padding: '12px 16px',
          fontSize: '0.875rem',
          fontFamily: "'Inter', system-ui, sans-serif",
          boxShadow: isDark
            ? '0 10px 15px -3px rgba(0,0,0,0.4)'
            : '0 10px 15px -3px rgba(0,0,0,0.08)',
        },
        success: {
          iconTheme: {
            primary: '#10B981',
            secondary: isDark ? '#1E293B' : '#FFFFFF',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: isDark ? '#1E293B' : '#FFFFFF',
          },
        },
      }}
    />
  );
}
