import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckSquare, BellOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as notificationApi from '../../api/notification.api';
import { useAuth } from '../../hooks/useAuth';
import { useNotificationStore } from '../../store/notificationStore';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { unreadCount, setUnreadCount } = useNotificationStore();

  const { data: response } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getNotifications(),
    enabled: !!user,
    select: (res) => {
      const list = res.data || [];
      const unreads = list.filter((n: any) => !n.readBy.includes(user?.id)).length;
      setUnreadCount(unreads);
      return list.slice(0, 5); // top 5
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const list = response || [];

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
        id="notification-bell-btn"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Bell Dropdown Popup */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2.5 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="flex items-center gap-1 text-[10px] text-primary-600 dark:text-primary-400 font-semibold hover:underline cursor-pointer"
                  id="mark-all-read-btn"
                >
                  <CheckSquare className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <BellOff className="w-6 h-6 mb-1 text-slate-350 dark:text-slate-650" />
                  <p className="text-[10px] font-medium">All caught up!</p>
                </div>
              ) : (
                list.map((notif: any) => {
                  const isRead = notif.readBy.includes(user?.id);
                  return (
                    <div
                      key={notif._id}
                      onClick={() => !isRead && markReadMutation.mutate(notif._id)}
                      className={`p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer text-left ${
                        !isRead ? 'bg-primary-50/10 dark:bg-primary-950/5' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className={`text-xs text-slate-800 dark:text-slate-200 line-clamp-1 ${!isRead ? 'font-semibold' : ''}`}>
                          {notif.title}
                        </p>
                        {!isRead && <span className="w-1.5 h-1.5 bg-primary-500 rounded-full shrink-0 mt-1" />}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1">
                        {new Date(notif.createdAt).toLocaleDateString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <Link
              to={user?.role === 'admin' ? '/admin/notifications' : user?.role === 'faculty' ? '/faculty/notifications' : '/student/notifications'}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-primary-600 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 transition-colors"
            >
              View all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
};
