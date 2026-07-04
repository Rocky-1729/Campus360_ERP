import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username / Hall Ticket / Faculty ID is required'),
  password: z.string().min(4, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setLoginError(null);
      // login takes LoginCredentials which now has { identifier, password }
      await login(values);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-white text-center mb-1 tracking-tight">
        Academic Portal
      </h3>
      <p className="text-xs text-slate-400 text-center mb-6">
        Log in with your Hall Ticket, Faculty ID, or Admin credentials
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" id="login-form">
        {loginError && (
          <div className="p-3 bg-danger-500/10 border border-danger-500/20 text-danger-500 rounded-xl text-xs font-semibold text-center">
            {loginError}
          </div>
        )}

        <Input
          {...register('identifier')}
          label="Username / Hall Ticket / Faculty ID"
          placeholder="e.g. 23TP1A0501 or admin@campus360.edu"
          error={errors.identifier?.message}
          icon={<User className="w-4 h-4" />}
          id="identifier-input"
        />

        <div className="relative">
          <Input
            {...register('password')}
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            error={errors.password?.message}
            icon={<Lock className="w-4 h-4" />}
            id="password-input"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-[34px] p-1 text-slate-500 hover:text-slate-300 rounded-md transition-colors"
            id="toggle-password-visibility"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2 py-2.5 font-semibold text-xs tracking-wider"
          isLoading={isSubmitting}
          id="login-submit-btn"
        >
          <ShieldCheck className="w-4 h-4 mr-1.5" /> Sign In
        </Button>
      </form>
    </div>
  );
};
