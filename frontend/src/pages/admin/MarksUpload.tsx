import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { FileUpload } from '../../components/ui/FileUpload';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';

export const MarksUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [academicYear, setAcademicYear] = useState<string>('2025-26');
  const [semester, setSemester] = useState<string>('');
  const [result, setResult] = useState<any | null>(null);

  const uploadMutation = useMutation({
    mutationFn: ({ file, year, sem }: { file: File; year: string; sem: string }) => adminApi.uploadMarks(file, year, sem),
    onSuccess: (res: any) => {
      setResult(res.data);
      toast.success('Marks processed successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'File upload failed.');
    },
  });

  const handleDownloadTemplate = () => {
    const headers = [
      'hallTicketNumber',
      'subjectCode',
      'subjectName',
      'internalMarks',
      'externalMarks',
      'totalMarks',
      'grade',
      'credits',
      'sgpa',
      'cgpa',
      'result',
      'semester',
    ];
    const sampleRow = [
      '2026CSE01',
      'CS301',
      'Web Technologies',
      '24',
      '55',
      '79',
      'A+',
      '4',
      '8.5',
      '8.2',
      'Pass',
      '3-1',
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), sampleRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'marks_master_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = () => {
    if (!file || !academicYear) {
      toast.error('Please select an academic year and file.');
      return;
    }
    uploadMutation.mutate({ file, year: academicYear, sem: semester });
  };

  const yearOptions = [
    { label: '2022-23', value: '2022-23' },
    { label: '2023-24', value: '2023-24' },
    { label: '2024-25', value: '2024-25' },
    { label: '2025-26', value: '2025-26' },
    { label: '2026-27', value: '2026-27' },
  ];

  const semesterOptions = [
    { label: 'Auto-detect from Sheet Header', value: '' },
    { label: '1-1', value: '1-1' },
    { label: '1-2', value: '1-2' },
    { label: '2-1', value: '2-1' },
    { label: '2-2', value: '2-2' },
    { label: '3-1', value: '3-1' },
    { label: '3-2', value: '3-2' },
    { label: '4-1', value: '4-1' },
    { label: '4-2', value: '4-2' },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Import Semester Results</h2>
          <p className="text-xs text-slate-400">Upload official spreadsheet to import and register academic marks.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} id="download-marks-template-btn">
          <Download className="w-4 h-4 mr-2" /> Download Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload card */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Upload Marks Spreadsheet</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              options={yearOptions}
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              label="Academic Year"
              id="marks-year-select"
            />
            <Select
              options={semesterOptions}
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              label="Semester (Optional Override)"
              id="marks-semester-select"
            />
          </div>

          <FileUpload onFileSelect={(f) => setFile(f)} accept=".xlsx,.xls,.csv" id="marks-excel-uploader" />

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
              isLoading={uploadMutation.isPending}
              id="marks-excel-submit-btn"
            >
              Upload Marks Spreadsheet
            </Button>
          </div>
        </div>

        {/* Instructions panel */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Instructions</h3>
          <ul className="space-y-2.5 text-xs text-slate-500 dark:text-slate-400 list-disc pl-4 leading-relaxed">
            <li>Ensure the file format conforms to the downloadable CSV template headers.</li>
            <li><strong>Hall Ticket Number</strong>, <strong>Subject Code</strong>, and <strong>Semester</strong> are required inputs.</li>
            <li>Duplicate mark uploads for the same student + subject + semester + academic year will automatically overwrite existing values (upsert).</li>
            <li>Semester must match format: <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-primary-600 font-mono text-[10px]">1-1, 1-2, 2-1, 2-2, 3-1, 3-2, 4-1, 4-2</code>.</li>
            <li>Results must be either: <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-primary-600 font-mono text-[10px]">Pass, Fail, Detained</code>.</li>
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
