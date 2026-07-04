import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
}

export function Card({ children, className = '', padding = true, hover = false }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2, boxShadow: 'var(--shadow-lg)' } : undefined}
      className={`card-base ${padding ? 'p-6' : ''} ${className}`}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  color?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  change,
  changeType = 'neutral',
  color = 'primary',
  className = '',
}: StatCardProps) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
    success: 'bg-success-100 text-success-600 dark:bg-success-700/20 dark:text-success-500',
    danger: 'bg-danger-100 text-danger-600 dark:bg-danger-700/20 dark:text-danger-500',
    warning: 'bg-warning-100 text-warning-600 dark:bg-warning-700/20 dark:text-warning-500',
    info: 'bg-info-100 text-info-600 dark:bg-info-600/20 dark:text-info-500',
  };

  const changeColor: Record<string, string> = {
    positive: 'text-success-500',
    negative: 'text-danger-500',
    neutral: 'text-surface-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, boxShadow: 'var(--shadow-lg)' }}
      transition={{ duration: 0.3 }}
      className={`card-base p-6 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            {title}
          </p>
          <p
            className="mt-2 text-3xl font-bold tabular-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            {value}
          </p>
          {change && (
            <p className={`mt-1 text-xs font-medium ${changeColor[changeType]}`}>
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorMap[color] || colorMap.primary}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
