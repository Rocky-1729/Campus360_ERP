import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, BookMarked, CheckSquare, ClipboardCheck, BarChart3, GraduationCap } from 'lucide-react';
import * as facultyApi from '../../api/faculty.api';
import { StatsCard } from '../../components/shared/StatsCard';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

export const FacultyDashboard: React.FC = () => {
  const { data: response, isLoading } = useQuery({
    queryKey: ['facultyDashboard'],
    queryFn: () => facultyApi.getDashboard(),
  });

  if (isLoading) return <LoadingScreen />;

  const stats = response?.data || {
    totalAssignedStudents: 0,
    assignments: 0,
  };

  return (
    <div className="space-y-6 text-left">
      {/* Welcome Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-xl font-bold">Hello, Faculty Member</h2>
        <p className="text-xs text-slate-400 mt-1">
          Welcome to the Faculty administration panel. You can mark attendance, review student certificates and see class analytics.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Assigned Students"
          value={stats.totalAssignedStudents}
          icon={<Users className="w-5 h-5" />}
          description="Students enrolled in your sections"
          id="faculty-stat-students"
        />
        <StatsCard
          title="Subject Mappings"
          value={stats.assignments}
          icon={<BookMarked className="w-5 h-5" />}
          description="Courses assigned to teach"
          id="faculty-stat-assignments"
        />
        <StatsCard
          title="Attendance Completed"
          value="Active"
          icon={<CheckSquare className="w-5 h-5" />}
          description="Mark daily student sessions"
          id="faculty-stat-attendance"
        />
      </div>
    </div>
  );
};
