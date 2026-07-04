import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Calendar, BookOpen, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import * as facultyApi from '../../api/faculty.api';
import * as adminApi from '../../api/admin.api';
import { useAuth } from '../../hooks/useAuth';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export const AttendanceMarking: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [subjectId, setSubjectId] = useState<string>('');
  const [section, setSection] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'late'>>({});

  // Fetch faculty assignments to select subjects and sections
  const { data: assignmentsRes } = useQuery({
    queryKey: ['facultyAssignmentsForAttendance'],
    queryFn: () => adminApi.getAssignments(), // Fetch assignments
    select: (res) => {
      // Filter assignments for current faculty member
      return res.data ? res.data.filter((a: any) => a.facultyId?._id === user?.profile?._id) : [];
    },
    enabled: !!user?.profile?._id,
  });

  const assignments = assignmentsRes || [];

  // Subject Dropdown options
  const subjectOptions = [
    ...new Map(
      assignments.map((a: any) => [
        a.subjectId?._id,
        { label: `${a.subjectId?.subjectName} (${a.subjectId?.subjectCode})`, value: a.subjectId?._id },
      ])
    ).values(),
  ];

  // Section options based on selected subject
  const sectionOptions = assignments
    .filter((a: any) => a.subjectId?._id === subjectId)
    .map((a: any) => ({ label: `Section ${a.section}`, value: a.section }));

  // Query student marking list
  const { data: studentsRes, isLoading: loadingStudents } = useQuery({
    queryKey: ['attendanceMarkingList', subjectId, section, date],
    queryFn: () => facultyApi.getAttendanceForMarking({ subjectId, section, date }),
    enabled: !!subjectId && !!section && !!date,
    onSuccess: (res: any) => {
      // Initialize local state records
      const initial: Record<string, 'present' | 'absent' | 'late'> = {};
      res.data?.forEach((s: any) => {
        initial[s.hallTicketNumber] = s.status || 'present'; // Default to present if unmarked
      });
      setAttendanceRecords(initial);
    },
  });

  const studentsList = studentsRes?.data || [];

  const markMutation = useMutation({
    mutationFn: (records: any[]) => facultyApi.markAttendance(records),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['attendanceMarkingList'] });
      toast.success(res.message || 'Attendance saved successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save attendance.');
    },
  });

  const handleStatusChange = (hallTicket: string, status: 'present' | 'absent' | 'late') => {
    setAttendanceRecords((prev) => ({
      ...prev,
      [hallTicket]: status,
    }));
  };

  const handleMarkAll = (status: 'present' | 'absent' | 'late') => {
    const updated: Record<string, 'present' | 'absent' | 'late'> = {};
    studentsList.forEach((s: any) => {
      updated[s.hallTicketNumber] = status;
    });
    setAttendanceRecords(updated);
  };

  const handleSave = () => {
    const list = studentsList.map((s: any) => ({
      hallTicketNumber: s.hallTicketNumber,
      subjectId,
      status: attendanceRecords[s.hallTicketNumber] || 'present',
      date,
      semester: assignments.find((a: any) => a.subjectId?._id === subjectId)?.semester || '1-1',
      section,
    }));
    markMutation.mutate(list);
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Daily Attendance Marking</h2>
        <p className="text-xs text-slate-400">Select class subject, section, date and mark students present status.</p>
      </div>

      {/* Selector controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <Select
          options={subjectOptions}
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setSection('');
          }}
          label="Select Subject"
          placeholder="-- Select Subject --"
          id="att-subject-select"
        />
        <Select
          options={sectionOptions}
          value={section}
          onChange={(e) => setSection(e.target.value)}
          disabled={!subjectId}
          label="Select Section"
          placeholder="-- Select Section --"
          id="att-section-select"
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          label="Select Date"
          id="att-date-picker"
        />
      </div>

      {/* Attendance Checklist Grid */}
      {subjectId && section && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-105 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-primary-500" /> Student Checklist
            </h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => handleMarkAll('present')} id="btn-mark-all-present">
                All Present
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleMarkAll('absent')} id="btn-mark-all-absent">
                All Absent
              </Button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-850">
            {loadingStudents ? (
              <p className="text-xs text-center py-6 text-slate-400">Loading student checklist...</p>
            ) : studentsList.length === 0 ? (
              <p className="text-xs text-center py-6 text-slate-400">No students found in this section.</p>
            ) : (
              studentsList.map((s: any) => {
                const currentStatus = attendanceRecords[s.hallTicketNumber] || 'present';
                return (
                  <div key={s.hallTicketNumber} className="flex items-center justify-between py-3.5">
                    <div>
                      <p className="text-xs font-semibold text-slate-850 dark:text-slate-200">{s.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{s.hallTicketNumber}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleStatusChange(s.hallTicketNumber, 'present')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          currentStatus === 'present'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleStatusChange(s.hallTicketNumber, 'absent')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          currentStatus === 'absent'
                            ? 'bg-danger-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        Absent
                      </button>
                      <button
                        onClick={() => handleStatusChange(s.hallTicketNumber, 'late')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          currentStatus === 'late'
                            ? 'bg-warning-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        Late
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={studentsList.length === 0 || markMutation.isPending}
              isLoading={markMutation.isPending}
              id="save-attendance-btn"
            >
              Save Attendance
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
