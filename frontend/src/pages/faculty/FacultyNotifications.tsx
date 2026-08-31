import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, Send } from "lucide-react";
import toast from "react-hot-toast";
import { notificationApi } from "../../api/notification.api";
import { adminApi } from "../../api/admin.api";
import { useAuth } from "../../hooks/useAuth";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";

const notificationSchema = z.object({
  type: z.string().min(1, "Type is required"),
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message details is required"),
  targetRole: z.literal("student"),
  targetSection: z.string().min(1, "Section is required"),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

export const FacultyNotifications: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch sent notifications
  const { data: notificationsRes, isLoading } = useQuery({
    queryKey: ["notificationsListFaculty"],
    queryFn: () => notificationApi.getNotifications(),
    select: (res) => {
      // Filter list where senderId equals current faculty member user ID
      return res.data
        ? res.data.filter((n: any) => n.senderId === user?.id)
        : [];
    },
  });

  // Fetch faculty assignments to get sections
  const facultyProfileId = user?.profile?._id || user?._id;

  const { data: assignmentsRes } = useQuery({
    queryKey: ["facultyAssignmentsForNotifCompose"],
    queryFn: () => adminApi.getAssignments(),
    select: (res) => {
      return res.data
        ? res.data.filter(
            (a: any) =>
              a.facultyId?._id === facultyProfileId ||
              a.facultyId === facultyProfileId,
          )
        : [];
    },
    enabled: !!facultyProfileId,
  });

  const assignments = assignmentsRes || [];
  const sectionOptions = [
    ...new Set(assignments.map((a: any) => a.section)),
  ].map((sec: any) => ({
    label: `Section ${sec}`,
    value: sec,
  }));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      type: "Circular",
      targetRole: "student",
      targetSection: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => notificationApi.createNotification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationsListFaculty"] });
      toast.success("Announcement sent successfully");
      reset({
        type: "Circular",
        title: "",
        message: "",
        targetRole: "student",
        targetSection: "",
      });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send announcement");
    },
  });

  const onSubmit = (values: NotificationFormValues) => {
    createMutation.mutate(values);
  };

  const notifications = notificationsRes || [];

  const columns: Column<any>[] = [
    { header: "Title", accessor: "title", sortable: true, sortKey: "title" },
    {
      header: "Category",
      accessor: (row) => <Badge variant="info">{row.type}</Badge>,
    },
    { header: "Section", accessor: "targetSection" },
    {
      header: "Date",
      accessor: (row) =>
        new Date(row.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
  ];

  const typeOptions = [
    { label: "Exam Notification", value: "Exam" },
    { label: "Workshop Notice", value: "Workshop" },
    { label: "Class Announcement", value: "Circular" },
  ];

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          Class Announcements
        </h2>
        <p className="text-xs text-slate-400">
          Post announcements and notification alerts to your assigned sections.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composition Card */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm h-fit">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary-500" /> Post Announcement
          </h3>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            id="announcement-form"
          >
            <Select
              {...register("type")}
              options={typeOptions}
              label="Announcement Category *"
              error={errors.type?.message}
              id="announcement-type"
            />
            <Select
              {...register("targetSection")}
              options={sectionOptions}
              label="Select Section *"
              placeholder="-- Select --"
              error={errors.targetSection?.message}
              id="announcement-section"
            />
            <Input
              {...register("title")}
              label="Announcement Title *"
              placeholder="e.g. Midterm 1 Syllabus Details"
              error={errors.title?.message}
              id="announcement-title"
            />
            <div className="text-left">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">
                Announcement Message *
              </label>
              <textarea
                {...register("message")}
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all min-h-[100px]"
                placeholder="Write announcement details..."
                id="announcement-message"
              />
              {errors.message?.message && (
                <p className="text-[11px] text-danger-500 mt-1 font-medium">
                  {errors.message?.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isSubmitting || createMutation.isPending}
              id="announcement-submit"
            >
              <Send className="w-4 h-4 mr-2" /> Post Announcement
            </Button>
          </form>
        </div>

        {/* Announcements list logs */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Post announcement history log
          </h3>
          <Table
            columns={columns}
            data={notifications}
            isLoading={isLoading}
            id="faculty-announcements-table"
          />
        </div>
      </div>
    </div>
  );
};
