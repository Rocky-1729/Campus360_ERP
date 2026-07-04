import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, BookMarked } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

const assignmentSchema = z.object({
  facultyId: z.string().min(1, 'Faculty is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  section: z.string().min(1, 'Section is required').toUpperCase(),
  semester: z.string().min(1, 'Semester is required'),
  academicYear: z.string().min(1, 'Academic Year is required'),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export const AssignmentManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch list data
  const { data: assignmentsRes, isLoading: loadingAssignments } = useQuery({
    queryKey: ['assignmentsList'],
    queryFn: () => adminApi.getAssignments(),
  });

  const { data: facultyRes } = useQuery({
    queryKey: ['facultyListSelect'],
    queryFn: () => adminApi.getAllFaculty(),
  });

  const { data: subjectsRes } = useQuery({
    queryKey: ['subjectsListSelect'],
    queryFn: () => adminApi.getSubjects(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      section: 'A',
      semester: '1-1',
      academicYear: '2025-26',
    },
  });

  // Mutators
  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.createAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignmentsList'] });
      toast.success('Faculty assigned successfully');
      reset({
        facultyId: '',
        subjectId: '',
        section: 'A',
        semester: '1-1',
        academicYear: '2025-26',
      });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create assignment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignmentsList'] });
      toast.success('Assignment deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete assignment');
      setDeleteConfirmId(null);
    },
  });

  const onSubmit = (values: AssignmentFormValues) => {
    createMutation.mutate(values);
  };

  const assignments = assignmentsRes?.data || [];
  const facultyList = facultyRes?.data || [];
  const subjectsList = subjectsRes?.data || [];

  const facultyOptions = facultyList.map((f: any) => ({
    label: `${f.faculty.name} (${f.faculty.facultyId})`,
    value: f.faculty._id,
  }));

  const subjectOptions = subjectsList.map((s: any) => ({
    label: `${s.subjectName} (${s.subjectCode})`,
    value: s._id,
  }));

  const columns: Column<any>[] = [
    { header: 'Faculty Name', accessor: 'facultyId.name', sortable: true, sortKey: 'facultyName' },
    { header: 'Faculty ID', accessor: 'facultyId.facultyId' },
    {
      header: 'Subject',
      accessor: (row) => `${row.subjectId?.subjectName} (${row.subjectId?.subjectCode})`,
    },
    { header: 'Section', accessor: 'section' },
    { header: 'Semester', accessor: 'semester' },
    { header: 'Academic Year', accessor: 'academicYear' },
    {
      header: 'Actions',
      accessor: (row) => (
        <Button
          size="sm"
          variant="danger"
          onClick={() => setDeleteConfirmId(row._id)}
          id={`delete-assignment-btn-${row._id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  const semesterOptions = [
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
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Faculty Subject Assignment</h2>
        <p className="text-xs text-slate-400">Map faculty members to specific subjects and sections they will teach.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignment creation form */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm h-fit">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-primary-500" /> New Assignment
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" id="assignment-form">
            <Select
              {...register('facultyId')}
              options={facultyOptions}
              label="Select Faculty *"
              placeholder="-- Select --"
              error={errors.facultyId?.message}
              id="assignment-faculty-select"
            />
            <Select
              {...register('subjectId')}
              options={subjectOptions}
              label="Select Subject *"
              placeholder="-- Select --"
              error={errors.subjectId?.message}
              id="assignment-subject-select"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                {...register('section')}
                label="Section *"
                placeholder="e.g. A"
                error={errors.section?.message}
                id="assignment-section-field"
              />
              <Select
                {...register('semester')}
                options={semesterOptions}
                label="Semester *"
                error={errors.semester?.message}
                id="assignment-sem-select"
              />
            </div>
            <Select
              {...register('academicYear')}
              options={yearOptions}
              label="Academic Year *"
              error={errors.academicYear?.message}
              id="assignment-year-select"
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isSubmitting || createMutation.isPending}
              id="assignment-submit-btn"
            >
              Assign Faculty
            </Button>
          </form>
        </div>

        {/* Existing assignments list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Current Mapping Directory</h3>
          <Table
            columns={columns}
            data={assignments}
            isLoading={loadingAssignments}
            id="assignments-table"
          />
        </div>
      </div>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
        title="Delete Assignment"
        message="Are you sure you want to remove this faculty assignment? They will lose access to students in this class."
        id="delete-assignment-confirm"
      />
    </div>
  );
};
