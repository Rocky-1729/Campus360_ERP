import React from 'react';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from '../ui/ThemeToggle';
import { NotificationBell } from '../shared/NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, title = 'Dashboard' }) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between w-full h-16 px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/80">
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger menu */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
          id="mobile-menu-btn"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic header title */}
        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme toggle switch */}
        <ThemeToggle />

        {/* Notifications list bell */}
        <NotificationBell />

        {/* User profile identifier */}
        <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800 text-left">
          <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-semibold text-sm border border-primary-500/20">
            {user?.email.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {user?.email.split('@')[0]}
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {user?.role}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
