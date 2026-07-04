import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationApi } from '../../api/notification.api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';

const notificationSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message details is required'),
  targetRole: z.string().min(1, 'Target Role is required'),
  targetSection: z.string().optional(),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

export const AdminNotifications: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch list of sent notifications
  const { data: response, isLoading } = useQuery({
    queryKey: ['notificationsList'],
    queryFn: () => notificationApi.getNotifications(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      type: 'Circular',
      targetRole: 'all',
      targetSection: '',
    },
  });

  // Mutator
  const createMutation = useMutation({
    mutationFn: (data: any) => notificationApi.createNotification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationsList'] });
      toast.success('Broadcast sent successfully');
      reset({
        type: 'Circular',
        title: '',
        message: '',
        targetRole: 'all',
        targetSection: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to send notification');
    },
  });

  const onSubmit = (values: NotificationFormValues) => {
    createMutation.mutate(values);
  };

  const notifications = response?.data || [];

  const columns: Column<any>[] = [
    { header: 'Title', accessor: 'title', sortable: true, sortKey: 'title' },
    {
      header: 'Category',
      accessor: (row) => <Badge variant="info">{row.type}</Badge>,
    },
    { header: 'Audience', accessor: (row) => `${row.targetRole.toUpperCase()} ${row.targetSection ? `(${row.targetSection})` : ''}` },
    { header: 'Author', accessor: 'senderName' },
    {
      header: 'Date',
      accessor: (row) =>
        new Date(row.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
  ];

  const typeOptions = [
    { label: 'Exam Notification', value: 'Exam' },
    { label: 'Placement Drive', value: 'Placement Drive' },
    { label: 'Workshop Notice', value: 'Workshop' },
    { label: 'Holiday Notice', value: 'Holiday' },
    { label: 'Department Circular', value: 'Circular' },
  ];

  const roleOptions = [
    { label: 'All users (Faculty & Students)', value: 'all' },
    { label: 'Faculty members only', value: 'faculty' },
    { label: 'Students only', value: 'student' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Circular Broadcasts</h2>
        <p className="text-xs text-slate-400">Broadcast official notifications, circulars and notices immediately.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composition Form */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm h-fit">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary-500" /> Compose Circular
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" id="circular-form">
            <Select
              {...register('type')}
              options={typeOptions}
              label="Circular Category *"
              error={errors.type?.message}
              id="circular-type-select"
            />
            <Input
              {...register('title')}
              label="Circular Title *"
              placeholder="e.g. End Semester Exam Timetable"
              error={errors.title?.message}
              id="circular-title-field"
            />
            <div className="text-left">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Message Details *
              </label>
              <textarea
                {...register('message')}
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all min-h-[100px]"
                placeholder="Write message content..."
                id="circular-message-field"
              />
              {errors.message?.message && (
                <p className="text-[11px] text-danger-500 mt-1 font-medium">{errors.message?.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                {...register('targetRole')}
                options={roleOptions}
                label="Target Audience *"
                error={errors.targetRole?.message}
                id="circular-role-select"
              />
              <Input
                {...register('targetSection')}
                label="Target Section (Optional)"
                placeholder="e.g. A"
                error={errors.targetSection?.message}
                id="circular-section-field"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isSubmitting || createMutation.isPending}
              id="circular-submit-btn"
            >
              <Send className="w-4 h-4 mr-2" /> Send Broadcast
            </Button>
          </form>
        </div>

        {/* Circulars sent log */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Circular Log history</h3>
          <Table
            columns={columns}
            data={notifications}
            isLoading={isLoading}
            id="circulars-table"
          />
        </div>
      </div>
    </div>
  );
};
