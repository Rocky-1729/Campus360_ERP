import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, GraduationCap, Award, BookOpen, Clock, Mail, Phone, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { Badge } from '../../components/ui/Badge';
import { StudentProfileCard } from '../../components/shared/StudentProfileCard';
import { Select } from '../../components/ui/Select';

export const StudentSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [queryTerm, setQueryTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('personal');
  const [semFilter, setSemFilter] = useState<string>('');

  // Query details when searching
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['studentProfileSearch', queryTerm],
    queryFn: () => adminApi.searchStudent(queryTerm),
    enabled: !!queryTerm,
    retry: false,
    onSuccess: () => {
      toast.success('Student found.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Student not found.');
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      toast.error('Please enter a Hall Ticket Number');
      return;
    }
    setQueryTerm(searchTerm.trim().toUpperCase());
  };

  const studentProfile = response?.data;

  // Tabs config
  const tabOptions = [
    { id: 'personal', label: 'Personal Info', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'academic', label: 'Academic Records', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'attendance', label: 'Attendance', icon: <Clock className="w-4 h-4" /> },
  ];

  // Marks Table Configuration
  const marksColumns: Column<any>[] = [
    { header: 'Code', accessor: 'subjectCode' },
    { header: 'Subject Name', accessor: 'subjectName' },
    { header: 'Internal', accessor: 'internalMarks' },
    { header: 'External', accessor: 'externalMarks' },
    { header: 'Total', accessor: 'totalMarks' },
    { header: 'Grade', accessor: 'grade' },
    { header: 'Credits', accessor: 'credits' },
    {
      header: 'Result',
      accessor: (row) => (
        <Badge variant={row.result === 'Pass' ? 'success' : 'danger'}>{row.result}</Badge>
      ),
    },
  ];

  // Attendance Table Configuration
  const attendanceColumns: Column<any>[] = [
    { header: 'Subject', accessor: 'subjectName' },
    { header: 'Total Classes', accessor: 'total' },
    { header: 'Present', accessor: 'present' },
    { header: 'Absent', accessor: 'absent' },
    { header: 'Late', accessor: 'late' },
    {
      header: 'Percentage',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden shrink-0">
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

  // Filters for marks based on semFilter
  const filteredMarks = studentProfile?.marks
    ? studentProfile.marks.filter((m: any) => !semFilter || m.semester === semFilter)
    : [];

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Student Profile Search</h2>
        <p className="text-xs text-slate-400">Search and retrieve complete student profiles, marks, and attendance histories.</p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm max-w-xl">
        <div className="flex-grow">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter Hall Ticket Number (e.g. 2026CSE01)"
            id="student-search-bar"
          />
        </div>
        <Button type="submit" variant="primary" isLoading={isLoading} id="student-search-submit">
          <Search className="w-4 h-4 mr-2" /> Search
        </Button>
      </form>

      {/* Profile Details Displays */}
      {studentProfile && (
        <div className="space-y-6">
          <StudentProfileCard student={studentProfile.student} />

          {/* Tab Selection */}
          <Tabs tabs={tabOptions} activeTab={activeTab} onChange={setActiveTab} id="student-search-tabs" />

          {/* Personal Info Tab */}
          {activeTab === 'personal' && (
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Family Contacts</h3>
                <div className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
                  <p><strong>Father Name:</strong> {studentProfile.student.fatherName || 'N/A'}</p>
                  <p><strong>Mother Name:</strong> {studentProfile.student.motherName || 'N/A'}</p>
                  <p><strong>Mobile Number:</strong> {studentProfile.student.mobile || 'N/A'}</p>
                  <p><strong>Official Email:</strong> {studentProfile.student.email || 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identity Details</h3>
                <div className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
                  <p><strong>Aadhaar Number:</strong> {studentProfile.student.aadhaarNumber || 'N/A'}</p>
                  <p><strong>ABC ID:</strong> {studentProfile.student.abcId || 'N/A'}</p>
                  <p><strong>Gender:</strong> {studentProfile.student.gender || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Academic Records Tab */}
          {activeTab === 'academic' && (
            <div className="space-y-4">
              <div className="w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-sm">
                <Select
                  options={semesterOptions}
                  value={semFilter}
                  onChange={(e) => setSemFilter(e.target.value)}
                  placeholder="All Semesters"
                  id="academic-sem-filter"
                />
              </div>

              <Table
                columns={marksColumns}
                data={filteredMarks}
                isLoading={false}
                emptyMessage="No marks uploaded for this student"
                id="student-search-marks"
              />
            </div>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Overall Progress */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-800">
                  <span className={`text-lg font-bold ${
                    studentProfile.attendanceSummary.percentage >= 75 ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {studentProfile.attendanceSummary.percentage}%
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Overall Attendance</h4>
                  <p className="text-xs text-slate-450 mt-1">
                    Present for {studentProfile.attendanceSummary.present} class(es) out of {studentProfile.attendanceSummary.total} total sessions.
                  </p>
                </div>
              </div>

              {/* Subject Breakdown */}
              <Table
                columns={attendanceColumns}
                data={studentProfile.attendanceSummary?.subjectWise || []}
                isLoading={false}
                emptyMessage="No attendance records registered"
                id="student-search-attendance"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
