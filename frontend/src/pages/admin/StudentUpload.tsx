import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Building2,
  Clock,
  History,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { excelUploadService } from "../../services/excelUpload.service";
import type {
  StudentMasterPreviewData,
  StudentMasterImportResult,
} from "../../services/excelUpload.service";
import { academicService } from "../../services/academic.service";
import { FileUpload } from "../../components/ui/FileUpload";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";

export const StudentUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);

  // Staged Preview States
  const [stagedPreview, setStagedPreview] = useState<StudentMasterPreviewData | null>(null);
  const [importResult, setImportResult] = useState<StudentMasterImportResult | null>(null);

  // Academic Context Selectors
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  // Load Real Academic Batches from PostgreSQL
  const { data: batches = [] } = useQuery({
    queryKey: ["uploadAcademicBatches"],
    queryFn: () => academicService.getBatches(),
  });

  // Load Sections for selected batch
  const { data: sections = [] } = useQuery({
    queryKey: ["uploadSections", selectedBatchId],
    queryFn: () => academicService.getSections(selectedBatchId || undefined),
  });

  // Load Upload Audit History from PostgreSQL
  const {
    data: uploadHistory = [],
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["excelUploadHistory"],
    queryFn: () => excelUploadService.getUploadHistory(),
  });

  // Preview Mutation
  const previewMutation = useMutation({
    mutationFn: (f: File) => excelUploadService.previewFile(f),
    onSuccess: (res: any) => {
      if (res.fileType !== "STUDENT_MASTER") {
        toast.error(
          `Detected file type is "${res.fileType}". For Examination Results, please use the Upload Marks page.`,
          { duration: 5000 }
        );
        return;
      }
      setStagedPreview(res as StudentMasterPreviewData);
      setImportResult(null);

      // Auto-select batch if metadata matches
      if (res.metadata?.batch && batches.length > 0) {
        const matchingBatch = batches.find((b) =>
          b.batchName.toLowerCase().includes(res.metadata.batch.toLowerCase())
        );
        if (matchingBatch) {
          setSelectedBatchId(matchingBatch.id);
        }
      }

      toast.success("Excel analyzed! Please review preview and confirm import.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to parse and validate spreadsheet.");
    },
  });

  // Import Confirmation Mutation
  const importMutation = useMutation({
    mutationFn: () => {
      if (!stagedPreview?.importToken) {
        throw new Error("No valid staged import token found. Please re-upload.");
      }
      return excelUploadService.confirmImport({
        token: stagedPreview.importToken,
        batchId: selectedBatchId ? Number(selectedBatchId) : undefined,
        sectionId: selectedSectionId ? Number(selectedSectionId) : undefined,
      });
    },
    onSuccess: (res: any) => {
      setImportResult(res as StudentMasterImportResult);
      // Clear token after successful import
      setStagedPreview(null);
      setFile(null);
      refetchHistory();
      toast.success("Student master records successfully imported into PostgreSQL!");
    },
    onError: (err: any) => {
      if (err.message?.includes("IMPORT_TOKEN_EXPIRED") || err.message?.includes("IMPORT_CONTEXT_EXPIRED")) {
        toast.error("Your import session has expired. Please upload and preview the Excel file again.", {
          duration: 6000,
        });
        setStagedPreview(null);
      } else {
        toast.error(err.message || "Import failed during database transaction.");
      }
    },
  });

  const handlePreviewUpload = () => {
    if (!file) return;
    previewMutation.mutate(file);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Hall Ticket No",
      "Full Name",
      "Gender",
      "Date of Birth",
      "Email",
      "Phone Number",
    ];
    const sampleRow = [
      "2026CSE01",
      "Rahul Sharma",
      "Male",
      "2004-05-15",
      "rahul@campus360.edu",
      "9876543210",
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), sampleRow.join(",")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_master_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Preview Columns Table Configuration
  const previewColumns: Column<any>[] = [
    { header: "Row", accessor: "rowNumber" },
    {
      header: "Hall Ticket",
      accessor: (row) => (
        <span className="font-mono font-bold text-primary-600">{row.hallTicketNumber}</span>
      ),
    },
    { header: "Full Name", accessor: "fullName" },
    { header: "Gender", accessor: (row) => row.gender || "N/A" },
    { header: "Date of Birth", accessor: (row) => row.dateOfBirth || "N/A" },
    { header: "Email", accessor: (row) => row.email || "N/A" },
    { header: "Phone", accessor: (row) => row.phoneNumber || "N/A" },
  ];

  // History Columns
  const historyColumns: Column<any>[] = [
    { header: "File Name", accessor: "fileName" },
    {
      header: "Status",
      accessor: (row) => (
        <Badge variant={row.uploadStatus === "COMPLETED" ? "success" : "danger"}>
          {row.uploadStatus}
        </Badge>
      ),
    },
    { header: "Total Rows", accessor: "totalRows" },
    { header: "Successful", accessor: "successfulRows" },
    { header: "Skipped / Failed", accessor: "failedRows" },
    { header: "Upload Time", accessor: "uploadedAt" },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-600" /> Import Student Master List
          </h2>
          <p className="text-xs text-slate-400">
            Real PostgreSQL Excel import engine. Upload student roster spreadsheets with preview & duplicate protection.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4 mr-2" /> Download Template
        </Button>
      </div>

      {/* Step 1: Upload & Staging Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              1. Select Spreadsheet for Preview
            </h3>
            {previewMutation.isPending && (
              <span className="text-xs text-primary-600 font-semibold animate-pulse">
                Analyzing Excel file...
              </span>
            )}
          </div>

          <FileUpload
            onFileSelect={(f) => {
              setFile(f);
              setStagedPreview(null);
            }}
            accept=".xlsx,.xls"
            maxSizeMB={10}
          />

          <div className="flex justify-between items-center pt-2">
            <span className="text-[11px] text-slate-400">
              Files are safely parsed and validated before touching PostgreSQL.
            </span>
            <Button
              variant="primary"
              onClick={handlePreviewUpload}
              disabled={!file || previewMutation.isPending}
              isLoading={previewMutation.isPending}
            >
              Analyze & Preview File
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3.5 text-xs text-slate-500 dark:text-slate-400">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary-500" /> Import Rules
          </h3>
          <ul className="space-y-2 list-disc pl-4 leading-relaxed">
            <li>Supports standard Excel formats: <code className="text-primary-600 font-bold">.xlsx</code> and <code className="text-primary-600 font-bold">.xls</code>.</li>
            <li><strong>Hall Ticket Number</strong> and <strong>Full Name</strong> are required fields.</li>
            <li>Existing students are <strong>safely skipped</strong> without throwing unique constraint violations.</li>
            <li>Unmapped personal numbers (Aadhaar, Parent Mobile) are <strong>excluded</strong> to protect student privacy.</li>
            <li>A temporary 30-minute token is issued for preview verification before database commit.</li>
          </ul>
        </div>
      </div>

      {/* Step 2: Staged Preview Display & Academic Context Selectors */}
      {stagedPreview && (
        <div className="p-6 bg-white dark:bg-slate-900 border-2 border-primary-500/20 dark:border-primary-500/30 rounded-3xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-full uppercase">
                  {stagedPreview.fileType}
                </span>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {stagedPreview.fileName}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                SHA-256: <span className="font-mono text-[10px]">{stagedPreview.fileHash.slice(0, 16)}...</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Token Active (30 min)
              </span>
            </div>
          </div>

          {/* Validation Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Total Rows</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                {stagedPreview.summary.totalRows}
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Valid Rows</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {stagedPreview.summary.validRows}
              </p>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">Duplicate Rows</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {stagedPreview.summary.duplicateRows}
              </p>
            </div>
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-2xl">
              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase">Invalid Rows</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {stagedPreview.summary.invalidRows}
              </p>
            </div>
          </div>

          {/* Detected Metadata */}
          {stagedPreview.metadata && Object.keys(stagedPreview.metadata).length > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-850/50 rounded-2xl text-xs flex flex-wrap gap-6 items-center">
              <span className="font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                Detected Sheet Metadata:
              </span>
              {stagedPreview.metadata.course && (
                <span><strong>Course:</strong> {stagedPreview.metadata.course}</span>
              )}
              {stagedPreview.metadata.branch && (
                <span><strong>Branch:</strong> {stagedPreview.metadata.branch}</span>
              )}
              {stagedPreview.metadata.batch && (
                <span><strong>Batch:</strong> {stagedPreview.metadata.batch}</span>
              )}
              {stagedPreview.metadata.semester && (
                <span><strong>Semester:</strong> {stagedPreview.metadata.semester}</span>
              )}
            </div>
          )}

          {/* Validation Errors If Any */}
          {stagedPreview.validationErrors && stagedPreview.validationErrors.length > 0 && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl space-y-2 text-xs">
              <span className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Validation Warnings ({stagedPreview.validationErrors.length})
              </span>
              <div className="max-h-36 overflow-y-auto divide-y divide-rose-100 dark:divide-rose-900/40">
                {stagedPreview.validationErrors.map((err, idx) => (
                  <div key={idx} className="py-1.5 text-[11px] text-rose-600 dark:text-rose-300 flex justify-between">
                    <span>Row {err.rowNumber} {err.hallTicketNumber ? `(${err.hallTicketNumber})` : ""}:</span>
                    <span>{err.errors.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Rows Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Sample Preview (Top 10 Rows)
            </h4>
            <Table
              columns={previewColumns}
              data={stagedPreview.preview || []}
              isLoading={false}
              emptyMessage="No preview data available"
            />
          </div>

          {/* Step 3: Academic Context Selection and Confirm Button */}
          <div className="p-5 bg-primary-500/5 border border-primary-500/20 rounded-2xl space-y-4">
            <h4 className="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4" /> 2. Assign Academic Enrollment (PostgreSQL)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select the Academic Batch and Section to enroll these students into database tables.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                  Academic Batch (Optional)
                </label>
                <Select
                  options={[
                    { label: "Select Academic Batch...", value: "" },
                    ...batches.map((b) => ({
                      label: b.batchName,
                      value: b.id,
                    })),
                  ]}
                  value={selectedBatchId}
                  onChange={(e) => {
                    setSelectedBatchId(e.target.value);
                    setSelectedSectionId("");
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                  Section (Optional)
                </label>
                <Select
                  options={[
                    { label: "Select Section...", value: "" },
                    ...sections.map((s) => ({
                      label: `Section ${s.sectionName}`,
                      value: s.id,
                    })),
                  ]}
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  disabled={!selectedBatchId && sections.length === 0}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-primary-500/20">
              <Button variant="outline" size="sm" onClick={() => setStagedPreview(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => importMutation.mutate()}
                isLoading={importMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Import to PostgreSQL
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Import Results Display */}
      {importResult && (
        <div className="p-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Import Successfully Completed
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Records from <strong>{importResult.fileName}</strong> have been committed into PostgreSQL.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total in Excel</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                {importResult.totalStudentsInExcel}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Inserted</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">
                {importResult.insertedStudents}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <p className="text-[10px] font-bold text-amber-600 uppercase">Skipped (Existing)</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">
                {importResult.skippedStudents}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <p className="text-[10px] font-bold text-primary-600 uppercase">Enrolled</p>
              <p className="text-xl font-bold text-primary-600 mt-0.5">
                {importResult.enrolledStudents}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Upload Audit History */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-primary-600" /> Recent Excel Upload Audit History
          </h3>
          <Button variant="ghost" size="sm" onClick={() => refetchHistory()} className="text-xs">
            Refresh
          </Button>
        </div>

        <Table
          columns={historyColumns}
          data={uploadHistory}
          isLoading={isHistoryLoading}
          emptyMessage="No upload history found in PostgreSQL."
        />
      </div>
    </div>
  );
};
