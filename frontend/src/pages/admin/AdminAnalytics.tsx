import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, AlertCircle, FileDown, GraduationCap, Users } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { BarChartCard } from '../../components/charts/BarChartCard';
import { PieChartCard } from '../../components/charts/PieChartCard';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { Select } from '../../components/ui/Select';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export const AdminAnalytics: React.FC = () => {
  const [semesterFilter, setSemesterFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('2025-26');

  // Fetch department analytics
  const { data: response, isLoading } = useQuery({
    queryKey: ['adminAnalytics', semesterFilter, yearFilter],
    queryFn: () => adminApi.getAnalytics({ semester: semesterFilter, academicYear: yearFilter }),
  });

  if (isLoading) return <LoadingScreen />;

  const analytics = response?.data || {
    totalStudents: 0,
    totalFaculty: 0,
    totalSubjects: 0,
    totalCertificates: 0,
    totalAchievements: 0,
    pendingCertificates: 0,
    pendingAchievements: 0,
    cgpaDistribution: {},
    attendanceDistribution: {},
  };

  // Convert CGPA distribution object to Recharts array
  const cgpaData = Object.keys(analytics.cgpaDistribution).map((key) => ({
    range: key,
    count: analytics.cgpaDistribution[key],
  }));

  // Convert Attendance distribution object to Recharts array
  const attendanceData = Object.keys(analytics.attendanceDistribution).map((key) => ({
    name: key,
    value: analytics.attendanceDistribution[key],
  }));

  const semesterOptions = [
    { label: 'All Semesters', value: '' },
    { label: '1-1', value: '1-1' },
    { label: '1-2', value: '1-2' },
    { label: '2-1', value: '2-1' },
    { label: '2-2', value: '2-2' },
    { label: '3-1', value: '3-1' },
    { label: '3-2', value: '3-2' },
    { label: '4-1', value: '4-1' },
    { label: '4-2', value: '4-2' },
  ];

  const yearOptions = [
    { label: '2024-25', value: '2024-25' },
    { label: '2025-26', value: '2025-26' },
    { label: '2026-27', value: '2026-27' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Department Analytics</h2>
          <p className="text-xs text-slate-400">View department-wide statistics, grade distributions, and performance graphs.</p>
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="w-full sm:w-48">
          <Select
            options={semesterOptions}
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            label="Semester Filter"
            id="analytics-sem-filter"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={yearOptions}
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            label="Academic Year"
            id="analytics-year-filter"
          />
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Registered Students</p>
          <p className="text-2xl font-bold text-slate-850 dark:text-slate-200 mt-1">{analytics.totalStudents}</p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Faculty Staff</p>
          <p className="text-2xl font-bold text-slate-850 dark:text-slate-200 mt-1">{analytics.totalFaculty}</p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Approved Certificates</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">
            {analytics.totalCertificates - analytics.pendingCertificates}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Approved Achievements</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">
            {analytics.totalAchievements - analytics.pendingAchievements}
          </p>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BarChartCard
          title="CGPA Bucket Distribution"
          data={cgpaData}
          xKey="range"
          yKey="count"
          color="#6366F1"
          id="cgpa-distribution-chart"
        />
        <PieChartCard
          title="Attendance Range Distribution"
          data={attendanceData}
          colors={['#10B981', '#F59E0B', '#EF4444', '#4F46E5']}
          id="attendance-distribution-chart"
        />
      </div>
    </div>
  );
};
