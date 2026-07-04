import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const iconColor: Record<string, string> = {
    danger: 'text-danger-500',
    warning: 'text-warning-500',
    primary: 'text-primary-500',
  };

  const btnVariant = variant === 'primary' ? 'primary' : 'danger';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={false}>
      <div className="text-center">
        <div
          className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            variant === 'danger'
              ? 'bg-danger-50 dark:bg-danger-700/20'
              : variant === 'warning'
                ? 'bg-warning-50 dark:bg-warning-700/20'
                : 'bg-primary-50 dark:bg-primary-900/20'
          }`}
        >
          <AlertTriangle className={`w-6 h-6 ${iconColor[variant]}`} />
        </div>
        <h3
          className="text-lg font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h3>
        <p
          className="text-sm mb-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          {message}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onClose} disabled={loading} id="confirm-dialog-cancel">
            {cancelText}
          </Button>
          <Button
            variant={btnVariant}
            onClick={onConfirm}
            loading={loading}
            id="confirm-dialog-confirm"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
