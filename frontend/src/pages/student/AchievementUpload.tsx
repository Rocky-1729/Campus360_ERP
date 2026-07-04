import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Award, Upload, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import * as studentApi from '../../api/student.api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FileUpload } from '../../components/ui/FileUpload';
import { Badge } from '../../components/ui/Badge';

const achievementSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
});

type AchievementFormValues = z.infer<typeof achievementSchema>;

export const AchievementUpload: React.FC = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  // Fetch student achievements list
  const { data: response, isLoading } = useQuery({
    queryKey: ['studentAchievements'],
    queryFn: () => studentApi.getAchievements(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AchievementFormValues>({
    resolver: zodResolver(achievementSchema),
  });

  const uploadMutation = useMutation({
    mutationFn: (data: FormData) => studentApi.uploadAchievement(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['studentAchievements'] });
      toast.success(res.message || 'Achievement uploaded successfully.');
      reset();
      setFile(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to upload achievement.');
    },
  });

  const onSubmit = (values: AchievementFormValues) => {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    formData.append('category', values.category);
    formData.append('title', values.title);
    formData.append('description', values.description || '');
    formData.append('date', values.date);

    uploadMutation.mutate(formData);
  };

  const achievements = response?.data || [];

  const columns: Column<any>[] = [
    { header: 'Title', accessor: 'title', sortable: true, sortKey: 'title' },
    { header: 'Category', accessor: 'category' },
    { header: 'Description', accessor: 'description' },
    {
      header: 'Date',
      accessor: (row) =>
        row.date
          ? new Date(row.date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : 'N/A',
    },
    {
      header: 'Status',
      accessor: (row) => {
        let variant: 'warning' | 'success' | 'danger' = 'warning';
        if (row.status === 'approved') variant = 'success';
        else if (row.status === 'rejected') variant = 'danger';
        return <Badge variant={variant}>{row.status.toUpperCase()}</Badge>;
      },
    },
    { header: 'Remarks', accessor: 'remarks' },
    {
      header: 'Actions',
      accessor: (row) =>
        row.documentUrl ? (
          <a
            href={row.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:underline"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        ) : (
          'N/A'
        ),
    },
  ];

  const categoryOptions = [
    { label: 'Sports Achievement', value: 'Sports' },
    { label: 'Coding Competition Winner', value: 'Coding Competition' },
    { label: 'Paper Presentation', value: 'Paper Presentation' },
    { label: 'Hackathon Win', value: 'Hackathon' },
    { label: 'Academic Research Publication', value: 'Research' },
    { label: 'Cultural Activity Award', value: 'Cultural Activities' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Upload Achievements</h2>
        <p className="text-xs text-slate-400">Upload and submit extra-curricular sports, coding, or cultural award achievements.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload form */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm h-fit">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary-500" /> New Achievement
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" id="achievement-form">
            <Select
              {...register('category')}
              options={categoryOptions}
              label="Achievement Category *"
              placeholder="-- Select --"
              error={errors.category?.message}
              id="ach-category-select"
            />
            <Input
              {...register('title')}
              label="Achievement Title *"
              placeholder="e.g. ACM ICPC Regional Finalist"
              error={errors.title?.message}
              id="ach-title-field"
            />
            <div className="text-left">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Description / Details
              </label>
              <textarea
                {...register('description')}
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all min-h-[60px]"
                placeholder="Give details of the award..."
                id="ach-description-field"
              />
            </div>
            <Input
              {...register('date')}
              type="date"
              label="Achievement Date *"
              error={errors.date?.message}
              id="ach-date-field"
            />

            <div className="text-left">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Upload Proof File (Optional PDF/Image)
              </label>
              <FileUpload onFileSelect={(f) => setFile(f)} accept=".pdf,image/*" id="ach-file-uploader" />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isSubmitting || uploadMutation.isPending}
              id="ach-submit-btn"
            >
              Submit Achievement
            </Button>
          </form>
        </div>

        {/* Uploaded achievements list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">My Upload Logs</h3>
          <Table columns={columns} data={achievements} isLoading={isLoading} id="student-achievements-table" />
        </div>
      </div>
    </div>
  );
};
