import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, BookOpen, Bell } from "lucide-react";
import { adminApi } from "../../api/admin.api";
import { StatsCard } from "../../components/shared/StatsCard";
import { LoadingScreen } from "../../components/shared/LoadingScreen";

export const AdminDashboard: React.FC = () => {
  const { data: response, isLoading } = useQuery({
    queryKey: ["adminDashboard"],
    queryFn: () => adminApi.getDashboard(),
  });

  if (isLoading) return <LoadingScreen />;

  const stats = response?.data || {
    totalStudents: 0,
    totalFaculty: 0,
    totalSubjects: 0,
    totalCertificates: 0,
    totalAchievements: 0,
    pendingCertificates: 0,
    pendingAchievements: 0,
    notificationsSent: 0,
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-left text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-xl font-bold">Hello, Department HOD</h2>
        <p className="text-xs text-slate-400 mt-1">
          Welcome to the Campus360 Department Administration panel. Here is your
          overview of CSE Department.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Students"
          value={stats.totalStudents}
          icon={<GraduationCap className="w-5 h-5" />}
          description="Registered students in database"
          id="stat-students"
        />
        <StatsCard
          title="Total Faculty"
          value={stats.totalFaculty}
          icon={<Users className="w-5 h-5" />}
          description="CSE department teaching staff"
          id="stat-faculty"
        />
        <StatsCard
          title="Total Courses"
          value={stats.totalSubjects}
          icon={<BookOpen className="w-5 h-5" />}
          description="Curriculum subjects listed"
          id="stat-subjects"
        />
        <StatsCard
          title="Broadcasts"
          value={stats.notificationsSent || 0}
          icon={<Bell className="w-5 h-5" />}
          description="Circulars sent this semester"
          id="stat-notifications"
        />
      </div>

      {/* Submissions Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {/* Certificate approvals panel */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Certificates Overview
            </h3>
            <span className="px-2.5 py-0.5 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 text-[10px] font-bold rounded-full border border-primary-200/40">
              {stats.totalCertificates} Total
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs">
            <span className="text-slate-500">Pending Review</span>
            <span className="font-bold text-amber-500">
              {stats.pendingCertificates} request(s)
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Approved Certificates</span>
            <span className="font-bold text-emerald-500">
              {stats.totalCertificates - stats.pendingCertificates} approved
            </span>
          </div>
        </div>

        {/* Achievements approvals panel */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Achievements Overview
            </h3>
            <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-200/40">
              {stats.totalAchievements} Total
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs">
            <span className="text-slate-500">Pending Review</span>
            <span className="font-bold text-amber-500">
              {stats.pendingAchievements} request(s)
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Approved Achievements</span>
            <span className="font-bold text-emerald-500">
              {stats.totalAchievements - stats.pendingAchievements} approved
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
