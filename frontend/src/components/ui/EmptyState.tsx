import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  id?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  id,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-6 border border-slate-100 dark:border-slate-800/80 rounded-2xl bg-slate-50/20 dark:bg-slate-900/10 text-center"
      id={id}
    >
      {icon && (
        <div className="mb-4 text-slate-350 dark:text-slate-650 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
        {title}
      </h3>
      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionText && onAction && (
        <Button onClick={onAction} variant="primary" size="sm" id={`${id}-action-btn`}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
