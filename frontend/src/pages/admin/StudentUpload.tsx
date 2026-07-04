import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileSpreadsheet, Download, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { FileUpload } from '../../components/ui/FileUpload';
import { Button } from '../../components/ui/Button';

export const StudentUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => adminApi.uploadStudents(file),
    onSuccess: (res: any) => {
      setResult(res.data);
      toast.success('Spreadsheet processed successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'File upload failed.');
    },
  });

  const handleDownloadTemplate = () => {
    // Generate CSV template for student upload
    const headers = [
      'hallTicketNumber',
      'name',
      'fatherName',
      'motherName',
      'email',
      'mobile',
      'dateOfBirth',
      'gender',
      'aadhaarNumber',
      'abcId',
      'department',
      'year',
      'section',
    ];
    const sampleRow = [
      '2026CSE01',
      'Rahul Sharma',
      'Vijay Sharma',
      'Sunita Sharma',
      'rahul@campus360.edu',
      '9876543210',
      '2002-05-15',
      'Male',
      '123456789012',
      'ABC123456',
      'CSE',
      '3',
      'A',
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), sampleRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'student_master_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = () => {
    if (!file) return;
    uploadMutation.mutate(file);
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Import Student Master List</h2>
          <p className="text-xs text-slate-400">Upload official spreadsheet to import and register department students.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} id="download-student-template-btn">
          <Download className="w-4 h-4 mr-2" /> Download Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload card */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Upload Spreadsheet</h3>
          <FileUpload onFileSelect={(f) => setFile(f)} accept=".xlsx,.xls,.csv" id="student-excel-uploader" />

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
              isLoading={uploadMutation.isPending}
              id="student-excel-submit-btn"
            >
              Upload Spreadsheet
            </Button>
          </div>
        </div>

        {/* Instructions panel */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Instructions</h3>
          <ul className="space-y-2.5 text-xs text-slate-500 dark:text-slate-400 list-disc pl-4 leading-relaxed">
            <li>Spreadsheet must contain headers matching the download template.</li>
            <li><strong>Hall Ticket Number</strong> and <strong>Name</strong> are required fields.</li>
            <li>Duplicate hall tickets will automatically update existing profiles (upsert).</li>
            <li>Emails must be unique across all users. If duplicate email exists for a new student, upload will skip the row.</li>
            <li>Birth dates should be formatted in YYYY-MM-DD format.</li>
            <li>A student user login account is created automatically using password: <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-primary-600 font-mono text-[10px]">hallTicketNumber@123</code>.</li>
          </ul>
        </div>
      </div>

      {/* Results details panel */}
      {result && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-left space-y-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3">Import Results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Total Rows</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">{result.summary.total}</p>
            </div>
            <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
              <p className="text-[10px] text-emerald-600 font-bold uppercase">Created</p>
              <p className="text-2xl font-bold text-emerald-500 mt-1">{result.summary.created}</p>
            </div>
            <div className="p-4 bg-primary-500/5 rounded-xl border border-primary-500/10">
              <p className="text-[10px] text-primary-600 font-bold uppercase">Updated</p>
              <p className="text-2xl font-bold text-primary-500 mt-1">{result.summary.updated}</p>
            </div>
            <div className="p-4 bg-danger-500/5 rounded-xl border border-danger-500/10">
              <p className="text-[10px] text-danger-600 font-bold uppercase">Failed</p>
              <p className="text-2xl font-bold text-danger-500 mt-1">{result.summary.failed}</p>
            </div>
          </div>

          {/* Import errors listing */}
          {result.summary.errors.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-warning-500" /> Skipped Rows & Warnings
              </h4>
              <div className="max-h-[220px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-850">
                {result.summary.errors.map((err: any, idx: number) => (
                  <div key={idx} className="p-3 text-xs flex justify-between gap-4">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      HT: {err.hallTicketNumber || 'N/A'}
                    </span>
                    <span className="text-danger-500 font-medium">{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
