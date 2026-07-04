import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Award, Upload, Download, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as studentApi from '../../api/student.api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FileUpload } from '../../components/ui/FileUpload';
import { Badge } from '../../components/ui/Badge';

const certificateSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  title: z.string().min(1, 'Title is required'),
  issuingOrganization: z.string().min(1, 'Organization is required'),
  issueDate: z.string().min(1, 'Date is required'),
});

type CertificateFormValues = z.infer<typeof certificateSchema>;

export const CertificateUpload: React.FC = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  // Fetch student certificates list
  const { data: response, isLoading } = useQuery({
    queryKey: ['studentCertificates'],
    queryFn: () => studentApi.getCertificates(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CertificateFormValues>({
    resolver: zodResolver(certificateSchema),
  });

  const uploadMutation = useMutation({
    mutationFn: (data: FormData) => studentApi.uploadCertificate(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['studentCertificates'] });
      toast.success(res.message || 'Certificate uploaded successfully.');
      reset();
      setFile(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to upload certificate.');
    },
  });

  const onSubmit = (values: CertificateFormValues) => {
    if (!file) {
      toast.error('Please select a certificate file.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', values.type);
    formData.append('title', values.title);
    formData.append('issuingOrganization', values.issuingOrganization);
    formData.append('issueDate', values.issueDate);

    uploadMutation.mutate(formData);
  };

  const certs = response?.data || [];

  const columns: Column<any>[] = [
    { header: 'Title', accessor: 'title', sortable: true, sortKey: 'title' },
    { header: 'Type', accessor: 'type' },
    { header: 'Organization', accessor: 'issuingOrganization' },
    {
      header: 'Issue Date',
      accessor: (row) =>
        row.issueDate
          ? new Date(row.issueDate).toLocaleDateString('en-IN', {
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
        row.certificateUrl ? (
          <a
            href={row.certificateUrl}
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

  const typeOptions = [
    { label: 'Internship Certificate', value: 'Internship' },
    { label: 'Workshop Certificate', value: 'Workshop' },
    { label: 'NPTEL Course', value: 'NPTEL' },
    { label: 'Coursera Course', value: 'Coursera' },
    { label: 'Technical Course', value: 'Technical Course' },
    { label: 'Hackathon Certificate', value: 'Hackathon' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Upload Certificates</h2>
        <p className="text-xs text-slate-400">Upload and submit co-curricular course, workshop or internship credentials for approval.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload form */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm h-fit">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary-500" /> New Certificate
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" id="certificate-form">
            <Select
              {...register('type')}
              options={typeOptions}
              label="Certificate Type *"
              placeholder="-- Select --"
              error={errors.type?.message}
              id="cert-type-select"
            />
            <Input
              {...register('title')}
              label="Certificate Title *"
              placeholder="e.g. Android Development Workshop"
              error={errors.title?.message}
              id="cert-title-field"
            />
            <Input
              {...register('issuingOrganization')}
              label="Issuing Organization *"
              placeholder="e.g. Google Academy / IIT Madras"
              error={errors.issuingOrganization?.message}
              id="cert-org-field"
            />
            <Input
              {...register('issueDate')}
              type="date"
              label="Issue Date *"
              error={errors.issueDate?.message}
              id="cert-date-field"
            />

            <div className="text-left">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Upload File (PDF/Image) *
              </label>
              <FileUpload onFileSelect={(f) => setFile(f)} accept=".pdf,image/*" id="cert-file-uploader" />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isSubmitting || uploadMutation.isPending}
              id="cert-submit-btn"
            >
              Submit Certificate
            </Button>
          </form>
        </div>

        {/* Uploaded certificates logs */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">My Upload Logs</h3>
          <Table columns={columns} data={certs} isLoading={isLoading} id="student-certs-table" />
        </div>
      </div>
    </div>
  );
};
