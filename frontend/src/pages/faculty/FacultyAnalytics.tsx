import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, PieChart, TrendingUp, AlertTriangle, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import * as facultyApi from '../../api/faculty.api';
import * as adminApi from '../../api/admin.api';
import { useAuth } from '../../hooks/useAuth';
import { BarChartCard } from '../../components/charts/BarChartCard';
import { PieChartCard } from '../../components/charts/PieChartCard';
import { Select } from '../../components/ui/Select';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import toast from 'react-hot-toast';

export const FacultyAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [section, setSection] = useState<string>('');
  const [semester, setSemester] = useState<string>('');
  const [subjectCode, setSubjectCode] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>('2025-26');

  // Fetch faculty assignments to select subjects and sections
  const { data: assignmentsRes } = useQuery({
    queryKey: ['facultyAssignmentsForAnalytics'],
    queryFn: () => adminApi.getAssignments(),
    select: (res) => {
      return res.data ? res.data.filter((a: any) => a.facultyId?._id === user?.profile?._id) : [];
    },
    enabled: !!user?.profile?._id,
  });

  const assignments = assignmentsRes || [];

  // Subject Dropdown options
  const subjectOptions = [
    { label: 'All Subjects', value: '' },
    ...new Map(
      assignments.map((a: any) => [
        a.subjectId?.subjectCode,
        { label: `${a.subjectId?.subjectName} (${a.subjectId?.subjectCode})`, value: a.subjectId?.subjectCode },
      ])
    ).values(),
  ];

  // Section options
  const sectionOptions = [
    { label: 'All Sections', value: '' },
    ...new Set(assignments.map((a: any) => a.section)),
  ].map((sec) => (typeof sec === 'string' ? { label: `Section ${sec}`, value: sec } : { label: 'All Sections', value: '' }));

  // Fetch Faculty Analytics
  const { data: analyticsRes, isLoading } = useQuery({
    queryKey: ['facultyAnalytics', section, semester, subjectCode, academicYear],
    queryFn: () =>
      facultyApi.getAnalytics({
        section,
        semester,
        subjectCode,
        academicYear,
      }),
    enabled: !!user?.profile?._id,
  });

  if (isLoading) return <LoadingScreen />;

  const analytics = analyticsRes?.data || {
    totalAssignedStudents: 0,
    assignments: 0,
    cgpaDistribution: {},
    attendanceDistribution: {},
    backlogAnalysis: {},
    topPerformers: [],
    atRiskStudents: [],
  };

  // Format Recharts data arrays
  const cgpaChartData = Object.keys(analytics.cgpaDistribution).map((key) => ({
    range: key,
    count: analytics.cgpaDistribution[key],
  }));

  const attendanceChartData = Object.keys(analytics.attendanceDistribution).map((key) => ({
    range: key,
    count: analytics.attendanceDistribution[key],
  }));

  const backlogChartData = Object.keys(analytics.backlogAnalysis).map((key) => ({
    name: key,
    value: analytics.backlogAnalysis[key],
  }));

  const topPerformersColumns: Column<any>[] = [
    { header: 'Rank', accessor: (_, index?: number) => <span className="font-bold">#{(index || 0) + 1}</span> },
    { header: 'Hall Ticket', accessor: 'hallTicketNumber' },
    { header: 'Name', accessor: 'name' },
    { header: 'CGPA', accessor: 'cgpa' },
  ];

  const atRiskColumns: Column<any>[] = [
    { header: 'Hall Ticket', accessor: 'hallTicketNumber' },
    { header: 'Name', accessor: 'name' },
    { header: 'CGPA', accessor: 'cgpa' },
    {
      header: 'Attendance',
      accessor: (row) => (
        <span className={row.attendancePercentage < 75 ? 'text-danger-500 font-bold' : 'text-slate-700'}>
          {row.attendancePercentage}%
        </span>
      ),
    },
  ];

  const handleExportCSV = () => {
    // Generate CSV for top performers
    const headers = ['Rank', 'Hall Ticket', 'Name', 'CGPA'];
    const rows = analytics.topPerformers.map((p: any, idx: number) => [
      idx + 1,
      p.hallTicketNumber,
      p.name,
      p.cgpa,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `class_top_performers_${academicYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported to CSV.');
  };

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
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Classroom Analytics</h2>
          <p className="text-xs text-slate-400">Analyze performance distributions, backlog analysis, and identify at-risk students.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} id="btn-export-csv">
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} id="btn-print-pdf">
            <FileText className="w-4 h-4 mr-2" /> Print PDF
          </Button>
        </div>
      </div>

      {/* Filter controls */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <Select
          options={sectionOptions}
          value={section}
          onChange={(e) => setSection(e.target.value)}
          label="Filter Section"
          id="analytics-section-select"
        />
        <Select
          options={semesterOptions}
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          label="Filter Semester"
          id="analytics-sem-select"
        />
        <Select
          options={subjectOptions}
          value={subjectCode}
          onChange={(e) => setSubjectCode(e.target.value)}
          label="Filter Subject"
          id="analytics-subject-select"
        />
        <Select
          options={yearOptions}
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          label="Academic Year"
          id="analytics-year-select"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Class Students</p>
          <p className="text-2xl font-bold text-slate-850 dark:text-slate-200 mt-1">{analytics.totalAssignedStudents}</p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Assigned Subjects</p>
          <p className="text-2xl font-bold text-slate-850 dark:text-slate-200 mt-1">{analytics.assignments}</p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase">At Risk Students</p>
          <p className="text-2xl font-bold text-rose-500 mt-1">{analytics.atRiskStudents.length}</p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Top Performers count</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{analytics.topPerformers.length}</p>
        </div>
      </div>

      {/* Visual Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BarChartCard
            title="CGPA Bucket Ranges"
            data={cgpaChartData}
            xKey="range"
            yKey="count"
            color="#4F46E5"
            id="faculty-cgpa-chart"
          />
        </div>
        <div>
          <PieChartCard
            title="Backlogs Distribution Analysis"
            data={backlogChartData}
            colors={['#10B981', '#F59E0B', '#EF4444', '#8B5CF6']}
            id="faculty-backlog-chart"
          />
        </div>
      </div>

      {/* BarChart for attendance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BarChartCard
          title="Attendance Distribution Analysis"
          data={attendanceChartData}
          xKey="range"
          yKey="count"
          color="#10B981"
          id="faculty-attendance-chart"
        />
      </div>

      {/* Performance lists details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Class Top Performers
          </h3>
          <Table
            columns={topPerformersColumns}
            data={analytics.topPerformers}
            isLoading={false}
            emptyMessage="No top performers data available"
            id="top-performers-table"
          />
        </div>

        {/* At Risk Students Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> At-Risk Students
          </h3>
          <Table
            columns={atRiskColumns}
            data={analytics.atRiskStudents}
            isLoading={false}
            emptyMessage="No at-risk students identified"
            id="at-risk-table"
          />
        </div>
      </div>
    </div>
  );
};
