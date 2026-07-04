import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Calendar } from 'lucide-react';
import * as studentApi from '../../api/student.api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { Badge } from '../../components/ui/Badge';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

export const AttendanceView: React.FC = () => {
  const { data: response, isLoading } = useQuery({
    queryKey: ['studentAttendance'],
    queryFn: () => studentApi.getAttendance(),
  });

  if (isLoading) return <LoadingScreen />;

  const attendanceData = response?.data || { records: [], summary: { overall: { total: 0, present: 0, absent: 0, late: 0, percentage: 0 }, subjectWise: [] } };
  const records = attendanceData.records || [];
  const summary = attendanceData.summary || { overall: { total: 0, present: 0, absent: 0, late: 0, percentage: 0 }, subjectWise: [] };

  const subjectColumns: Column<any>[] = [
    { header: 'Subject Code / Name', accessor: 'subjectName' },
    { header: 'Total Classes', accessor: 'total' },
    { header: 'Present', accessor: 'present' },
    { header: 'Absent', accessor: 'absent' },
    { header: 'Late', accessor: 'late' },
    {
      header: 'Attendance %',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden shrink-0">
            <div
              className={`h-2 rounded-full ${
                row.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(row.percentage, 100)}%` }}
            />
          </div>
          <span className={`font-semibold ${row.percentage >= 75 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {row.percentage}%
          </span>
        </div>
      ),
    },
  ];

  const logColumns: Column<any>[] = [
    {
      header: 'Date',
      accessor: (row) =>
        new Date(row.date).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    },
    { header: 'Subject Code', accessor: 'subjectId.subjectCode' },
    { header: 'Subject Name', accessor: 'subjectId.subjectName' },
    {
      header: 'Status',
      accessor: (row) => {
        let varColor: 'success' | 'danger' | 'warning' = 'success';
        if (row.status === 'absent') varColor = 'danger';
        else if (row.status === 'late') varColor = 'warning';
        return <Badge variant={varColor}>{row.status.toUpperCase()}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Attendance Profile</h2>
          <p className="text-xs text-slate-400">View overall summaries, subject-wise presence, and daily logs.</p>
        </div>
      </div>

      {/* Overall Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-800">
          <span className={`text-lg font-bold ${
            summary.overall.percentage >= 75 ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {summary.overall.percentage}%
          </span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Overall Attendance</h3>
          <p className="text-xs text-slate-500 mt-1">
            Attended {summary.overall.present} classes out of {summary.overall.total} total recorded sessions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject-wise breakdown */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary-500" /> Subject breakdown
          </h3>
          <Table
            columns={subjectColumns}
            data={summary.subjectWise}
            isLoading={false}
            id="subject-attendance-table"
          />
        </div>

        {/* Daily log history */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary-500" /> Attendance History Log
          </h3>
          <Table
            columns={logColumns}
            data={records}
            isLoading={false}
            id="log-attendance-table"
          />
        </div>
      </div>
    </div>
  );
};
