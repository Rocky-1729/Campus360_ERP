import {
  type ButtonHTMLAttributes,
  type ElementType,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "outline"
  | "success";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  isLoading?: boolean;
  as?: ElementType;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm",
  secondary:
    "bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-200 dark:hover:bg-surface-600",
  danger:
    "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700 shadow-sm",
  ghost:
    "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800",
  outline:
    "border border-[var(--border-primary)] text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  isLoading = false,
  children,
  disabled,
  className = "",
  as,
  ...props
}: ButtonProps) {
  const isBtnLoading = loading || isLoading;
  const Component = as || "button";

  return (
    <Component
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={Component === "button" ? disabled || isBtnLoading : undefined}
      {...props}
    >
      {isBtnLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </Component>
  );
}
