import { type ReactNode } from 'react';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-500 ring-success-600/20',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-700/20 dark:text-danger-500 ring-danger-600/20',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-700/20 dark:text-warning-500 ring-warning-600/20',
  info: 'bg-info-50 text-info-600 dark:bg-info-600/20 dark:text-info-500 ring-info-600/20',
  neutral: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300 ring-surface-500/20',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({
  variant = 'neutral',
  size = 'sm',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ring-1 ring-inset ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    Active: 'success',
    Inactive: 'danger',
    Approved: 'success',
    Pending: 'warning',
    Rejected: 'danger',
    Pass: 'success',
    Fail: 'danger',
    Detained: 'danger',
    Absent: 'neutral',
    Present: 'success',
    Late: 'warning',
  };

  return (
    <Badge variant={variantMap[status] || 'neutral'}>
      {status}
    </Badge>
  );
}
