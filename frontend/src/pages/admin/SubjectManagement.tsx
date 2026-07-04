import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, Trash2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

const subjectSchema = z.object({
  subjectCode: z.string().min(1, 'Subject Code is required'),
  subjectName: z.string().min(1, 'Subject Name is required'),
  credits: z.preprocess((val) => Number(val), z.number().min(0, 'Credits must be positive')),
  semester: z.string().min(1, 'Semester is required'),
  academicYear: z.string().min(1, 'Academic Year is required'),
});

type SubjectFormValues = z.infer<typeof subjectSchema>;

export const SubjectManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [semesterFilter, setSemesterFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('2025-26');

  // Fetch subjects list
  const { data: response, isLoading } = useQuery({
    queryKey: ['subjectsList', semesterFilter, yearFilter],
    queryFn: () => adminApi.getSubjects({ semester: semesterFilter, academicYear: yearFilter }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
  });

  // Mutators
  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.createSubject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      toast.success('Subject created successfully');
      setModalOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create subject');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateSubject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      toast.success('Subject updated successfully');
      setModalOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update subject');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteSubject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      toast.success('Subject deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete subject');
      setDeleteConfirmId(null);
    },
  });

  const handleAdd = () => {
    setEditingSubject(null);
    reset({
      subjectCode: '',
      subjectName: '',
      credits: 4,
      semester: '1-1',
      academicYear: '2025-26',
    });
    setModalOpen(true);
  };

  const handleEdit = (subject: any) => {
    setEditingSubject(subject);
    reset({
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      credits: subject.credits,
      semester: subject.semester,
      academicYear: subject.academicYear,
    });
    setModalOpen(true);
  };

  const onSubmit = (values: SubjectFormValues) => {
    if (editingSubject) {
      updateMutation.mutate({ id: editingSubject.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const subjects = response?.data || [];

  const columns: Column<any>[] = [
    { header: 'Subject Code', accessor: 'subjectCode', sortable: true, sortKey: 'subjectCode' },
    { header: 'Name', accessor: 'subjectName', sortable: true, sortKey: 'subjectName' },
    { header: 'Credits', accessor: 'credits' },
    { header: 'Semester', accessor: 'semester' },
    { header: 'Academic Year', accessor: 'academicYear' },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(row)}
            id={`edit-subject-btn-${row.subjectCode}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setDeleteConfirmId(row.id)}
            id={`delete-subject-btn-${row.subjectCode}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
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

  const yearOptions = [
    { label: '2024-25', value: '2024-25' },
    { label: '2025-26', value: '2025-26' },
    { label: '2026-27', value: '2026-27' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Subject Management</h2>
          <p className="text-xs text-slate-400">View and update directory records of course subjects.</p>
        </div>
        <Button variant="primary" size="md" onClick={handleAdd} id="add-subject-trigger-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Subject
        </Button>
      </div>

      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="w-full sm:w-48">
          <Select
            options={semesterOptions}
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            label="Filter by Semester"
            id="subject-sem-filter"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={yearOptions.filter(y => y.value !== '')}
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            label="Filter by Academic Year"
            id="subject-year-filter"
          />
        </div>
      </div>

      <Table columns={columns} data={subjects} isLoading={isLoading} id="subjects-table" />

      {/* Add / Edit Subject Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Add New Subject'}
        size="md"
        id="subject-form-modal"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              {...register('subjectCode')}
              label="Subject Code *"
              placeholder="e.g. CS301"
              error={errors.subjectCode?.message}
              disabled={!!editingSubject}
              id="subject-code-field"
            />
            <Input
              {...register('subjectName')}
              label="Subject Name *"
              placeholder="e.g. Web Technologies"
              error={errors.subjectName?.message}
              id="subject-name-field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              {...register('credits')}
              label="Credits *"
              type="number"
              placeholder="4"
              error={errors.credits?.message}
              id="subject-credits-field"
            />
            <Select
              {...register('semester')}
              options={semesterOptions.filter(o => o.value !== '')}
              label="Semester *"
              error={errors.semester?.message}
              id="subject-semester-field"
            />
            <Select
              {...register('academicYear')}
              options={yearOptions}
              label="Academic Year *"
              error={errors.academicYear?.message}
              id="subject-year-field"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} id="subject-form-cancel">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending || updateMutation.isPending}
              id="subject-form-submit"
            >
              {editingSubject ? 'Save Changes' : 'Create Subject'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
        title="Delete Subject"
        message="Are you sure you want to delete this subject? This action is permanent and cannot be undone."
        id="delete-subject-confirm"
      />
    </div>
  );
};
