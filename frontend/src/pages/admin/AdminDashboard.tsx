import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, BookOpen, FileSpreadsheet, Award } from "lucide-react";
import { studentsService } from "../../services/students.service";
import { examinationsService } from "../../services/examinations.service";
import { analyticsService } from "../../services/analytics.service";
import { StatsCard } from "../../components/shared/StatsCard";
import { LoadingScreen } from "../../components/shared/LoadingScreen";

export const AdminDashboard: React.FC = () => {
  const { data: studentCounts, isLoading: isStudentLoading } = useQuery({
    queryKey: ["adminDashboardStudentCounts"],
    queryFn: () => studentsService.getStatusCounts(),
  });

  const { data: examCounts, isLoading: isExamLoading } = useQuery({
    queryKey: ["adminDashboardExamCounts"],
    queryFn: () => examinationsService.getTableCounts(),
  });

  const { data: analytics } = useQuery({
    queryKey: ["adminDashboardAnalyticsOverview"],
    queryFn: () => analyticsService.getOverview(),
  });

  const isLoading = isStudentLoading || isExamLoading;
  if (isLoading) return <LoadingScreen />;

  const totalStudents = studentCounts?.students || 0;
  const activeEnrollments = studentCounts?.enrollments || 0;
  const totalCourses = examCounts?.subjects || 0;
  const totalExams = examCounts?.examinations || 0;
  const totalExamResults = examCounts?.examResults || 0;
  const totalUploads = examCounts?.excelUploads || 0;
  const studentsWithResults = analytics?.studentsWithResults || 0;
  const passPercentage = analytics?.passPercentage;
  const avgSgpa = analytics?.averageSGPA;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-left text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-xl font-bold">Hello, Department Administrator</h2>
        <p className="text-xs text-slate-400 mt-1">
          Connected to PostgreSQL database ("campus360"). Overview of academic entities, student rosters, and examination records.
        </p>
      </div>

      {/* Stats Cards Grid with Real PostgreSQL Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Students"
          value={totalStudents}
          icon={<GraduationCap className="w-5 h-5" />}
          description="Verified students in PostgreSQL"
          id="stat-students"
        />
        <StatsCard
          title="Active Enrollments"
          value={activeEnrollments}
          icon={<Users className="w-5 h-5" />}
          description="Batch & section enrollments"
          id="stat-enrollments"
        />
        <StatsCard
          title="Curriculum Subjects"
          value={totalCourses}
          icon={<BookOpen className="w-5 h-5" />}
          description="Global subjects catalog"
          id="stat-subjects"
        />
        <StatsCard
          title="Spreadsheets Imported"
          value={totalUploads}
          icon={<FileSpreadsheet className="w-5 h-5" />}
          description="Excel files in audit history"
          id="stat-uploads"
        />
      </div>

      {/* Submissions Section */}
      {/* Academic & Database Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {/* Examination Architecture overview */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary-500" /> Examination Architecture
            </h3>
            <span className="px-2.5 py-0.5 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 text-[10px] font-bold rounded-full border border-primary-200/40">
              {totalExams} Exam Sessions
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs">
            <span className="text-slate-500">Normalized Subject Results</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {totalExamResults} record(s)
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Active Curriculum Courses</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {totalCourses} courses
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Students with Results</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">
              {studentsWithResults} students
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Overall College Pass Rate</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {passPercentage !== null ? `${passPercentage}%` : "No results yet"}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Average SGPA</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">
              {avgSgpa !== null ? `${avgSgpa} / 10` : "No results yet"}
            </span>
          </div>
        </div>

        {/* Database & Audit overview */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Database & Audit Logs
            </h3>
            <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-200/40">
              {totalUploads} Imports
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs">
            <span className="text-slate-500">Verified Student Master Entities</span>
            <span className="font-bold text-primary-600 dark:text-primary-400">
              {totalStudents} students
            </span>
          </div>
          <div className="flex items-center justify-between py-2 text-xs border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Batch & Section Enrollments</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {activeEnrollments} enrollments
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
