import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, BookMarked, CheckSquare, Search, AlertCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import * as facultyApi from '../../api/faculty.api';
import { StatsCard } from '../../components/shared/StatsCard';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';

export const FacultyDashboard: React.FC = () => {
  const [backlogFilter, setBacklogFilter] = useState<'all' | '1' | '2' | '3+'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['facultyDashboard'],
    queryFn: () => facultyApi.getDashboard(),
  });

  if (isLoading) return <LoadingScreen />;

  const stats = response?.data || {
    totalAssignedStudents: 0,
    assignments: 0,
    backlogStudents: [],
  };

  const backlogStudents = stats.backlogStudents || [];

  // Count metrics for header buttons
  const oneBacklogCount = backlogStudents.filter((s: any) => s.backlogs === 1).length;
  const twoBacklogCount = backlogStudents.filter((s: any) => s.backlogs === 2).length;
  const multiBacklogCount = backlogStudents.filter((s: any) => s.backlogs >= 3).length;

  // Filter students based on active tab and search query
  const filteredBacklogs = backlogStudents.filter((student: any) => {
    if (backlogFilter === '1') return student.backlogs === 1;
    if (backlogFilter === '2') return student.backlogs === 2;
    if (backlogFilter === '3+') return student.backlogs >= 3;
    return true;
  });

  const searchedBacklogs = filteredBacklogs.filter((student: any) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.hallTicketNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-left">
      {/* Welcome Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-xl font-bold">Hello, Faculty Member</h2>
        <p className="text-xs text-slate-400 mt-1">
          Welcome to the Faculty administration panel. You can mark attendance, review student certificates, and see class analytics.
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

      {/* Student Backlogs Analysis Panel */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Assigned Students Backlog Directory
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identify and track backlog counts and failed subjects for students in your sections.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or hall ticket..."
              icon={<Search className="w-4 h-4 text-slate-400" />}
              id="backlog-search-field"
            />
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setBacklogFilter('all')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all ${
              backlogFilter === 'all'
                ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900'
                : 'bg-transparent border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/30'
            }`}
          >
            All Backlog Students ({backlogStudents.length})
          </button>
          <button
            onClick={() => setBacklogFilter('1')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all ${
              backlogFilter === '1'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
                : 'bg-transparent border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/30'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            1 Backlog ({oneBacklogCount})
          </button>
          <button
            onClick={() => setBacklogFilter('2')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all ${
              backlogFilter === '2'
                ? 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400 font-bold'
                : 'bg-transparent border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/30'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
            2 Backlogs ({twoBacklogCount})
          </button>
          <button
            onClick={() => setBacklogFilter('3+')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all ${
              backlogFilter === '3+'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold'
                : 'bg-transparent border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/30'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
            3+ Critical Backlogs ({multiBacklogCount})
          </button>
        </div>

        {/* Backlog List */}
        {searchedBacklogs.length === 0 ? (
          <div className="py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              No students found
            </p>
            <p className="text-xs text-slate-400 max-w-[280px] mx-auto">
              {searchQuery
                ? 'No matches found. Try adjusting your search query.'
                : 'Great! All assigned students are currently clear of any backlogs in this category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchedBacklogs.map((student: any, idx: number) => {
              // Decide badge color based on backlog severity
              let severityBadge = 'warning';
              let borderStyle = 'border-slate-200 dark:border-slate-800';
              if (student.backlogs === 2) {
                severityBadge = 'warning';
                borderStyle = 'border-orange-200 dark:border-orange-900/30';
              } else if (student.backlogs >= 3) {
                severityBadge = 'danger';
                borderStyle = 'border-rose-200 dark:border-rose-900/30';
              }

              return (
                <div
                  key={idx}
                  className={`p-4 bg-slate-50/50 dark:bg-slate-800/20 border ${borderStyle} rounded-2xl flex flex-col justify-between gap-4`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {student.hallTicketNumber}
                      </p>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {student.name}
                      </h4>
                    </div>
                    <Badge variant={severityBadge as any}>
                      {student.backlogs} {student.backlogs === 1 ? 'Backlog' : 'Backlogs'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Failed Subjects:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {student.failedSubjects.map((sub: any, sIdx: number) => (
                        <div
                          key={sIdx}
                          className="px-2.5 py-1.5 bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-lg text-xs font-semibold flex flex-col gap-0.5"
                        >
                          <span className="font-bold">{sub.subjectCode}</span>
                          <span className="text-[10px] opacity-80 font-normal leading-tight">
                            {sub.subjectName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
