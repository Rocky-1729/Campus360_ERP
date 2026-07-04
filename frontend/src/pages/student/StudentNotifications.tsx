import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckSquare, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import * as notificationApi from '../../api/notification.api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

export const StudentNotifications: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery({
    queryKey: ['notificationsListStudent'],
    queryFn: () => notificationApi.getNotifications(),
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationsListStudent'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationsListStudent'] });
      toast.success('All notifications marked as read.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update status.');
    },
  });

  if (isLoading) return <LoadingScreen />;

  const list = response?.data || [];
  const unreads = list.filter((n: any) => !n.readBy.includes(user?.id));

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Department Circulars</h2>
          <p className="text-xs text-slate-400">View circular notifications, holiday alerts, and announcements from HOD/faculty.</p>
        </div>
        {unreads.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} id="btn-mark-all-read">
            <CheckSquare className="w-4 h-4 mr-2" /> Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-4 max-w-3xl">
        {list.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-250 dark:border-slate-800 rounded-2xl">
            <p className="text-sm text-slate-400">No circular notifications available.</p>
          </div>
        ) : (
          list.map((notif: any) => {
            const isRead = notif.readBy.includes(user?.id);
            return (
              <div
                key={notif._id}
                onClick={() => !isRead && markReadMutation.mutate(notif._id)}
                className={`p-6 bg-white dark:bg-slate-900 border rounded-2xl transition-all cursor-pointer flex gap-4 ${
                  isRead
                    ? 'border-slate-200 dark:border-slate-850 opacity-80'
                    : 'border-primary-500/30 bg-primary-50/5 dark:bg-primary-950/5 shadow-sm shadow-primary-500/5'
                }`}
              >
                {/* Type Icon */}
                <div className={`p-3 rounded-xl shrink-0 h-fit ${
                  isRead ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-primary-500/10 text-primary-500'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>

                <div className="flex-grow space-y-2">
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-semibold text-slate-850 dark:text-slate-200 ${!isRead ? 'font-bold' : ''}`}>
                        {notif.title}
                      </h4>
                      {!isRead && <span className="w-1.5 h-1.5 bg-primary-500 rounded-full shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(notif.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                    <span>Sent by: {notif.senderName}</span>
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[8px]">
                      {notif.type}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
