import React from 'react';
import { motion } from 'framer-motion';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  description?: string;
  className?: string;
  id?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  description,
  className = '',
  id,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-left flex items-start justify-between gap-4 ${className}`}
      id={id}
    >
      <div>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {title}
        </p>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-2 font-sans tracking-tight">
          {value}
        </h3>
        {description && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium leading-none">
            {description}
          </p>
        )}
      </div>

      {icon && (
        <div className="p-3 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
    </motion.div>
  );
};
