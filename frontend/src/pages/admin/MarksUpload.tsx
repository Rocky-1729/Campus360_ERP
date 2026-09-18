import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Clock,
  History,
  GraduationCap,
  BookOpen,
  AlertCircle,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { excelUploadService } from "../../services/excelUpload.service";
import type {
  ExaminationResultPreviewData,
  ExaminationImportResult,
} from "../../services/excelUpload.service";
import { examinationsService } from "../../services/examinations.service";
import { academicService } from "../../services/academic.service";
import { FileUpload } from "../../components/ui/FileUpload";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import type { Column } from "../../components/ui/Table";

/**
 * Normalizes an arbitrary semester string representation (Roman, digit, hyphenated)
 * to an integer between 1 and 8.
 */
function parseSemesterNumber(val?: string | null): number | null {
  if (!val || typeof val !== "string") return null;
  const s = val.trim().toUpperCase();

  const yearSemMatch = s.match(
    /(?:(?:YEAR|B\.?TECH)\s*)?(IV|III|II|I|[1-4])\s*(?:YEAR|B\.?TECH)?\s*[-/–\s]\s*(?:YEAR|B\.?TECH|SEM|SEMESTER)?\s*(II|I|[1-2])\b/i
  );
  if (yearSemMatch) {
    const yStr = yearSemMatch[1].toUpperCase();
    const semStr = yearSemMatch[2].toUpperCase();
    let y = 1;
    if (yStr === "IV" || yStr === "4") y = 4;
    else if (yStr === "III" || yStr === "3") y = 3;
    else if (yStr === "II" || yStr === "2") y = 2;
    else if (yStr === "I" || yStr === "1") y = 1;

    let sem = 1;
    if (semStr === "II" || semStr === "2") sem = 2;
    else if (semStr === "I" || semStr === "1") sem = 1;

    return (y - 1) * 2 + sem;
  }

  const singleSemMatch =
    s.match(/(?:SEM|SEMESTER)\s*[-:]?\s*(VIII|VII|VI|V|IV|III|II|I|[1-8])\b/i) ||
    s.match(/\b(VIII|VII|VI|V|IV|III|II|I|[1-8])\s*(?:ST|ND|RD|TH)?\s*(?:SEM|SEMESTER)\b/i);
  if (singleSemMatch) {
    const raw = singleSemMatch[1].toUpperCase();
    const map: Record<string, number> = {
      I: 1, "1": 1,
      II: 2, "2": 2,
      III: 3, "3": 3,
      IV: 4, "4": 4,
      V: 5, "5": 5,
      VI: 6, "6": 6,
      VII: 7, "7": 7,
      VIII: 8, "8": 8,
    };
    if (map[raw]) return map[raw];
  }

  const digitMatch = s.match(/^[1-8]$/);
  if (digitMatch) return parseInt(digitMatch[0], 10);

  return null;
}

export const MarksUpload: React.FC = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  // Staged Preview States
  const [stagedPreview, setStagedPreview] = useState<ExaminationResultPreviewData | null>(null);
  const [importResult, setImportResult] = useState<ExaminationImportResult | null>(null);

  // Filter States: Simplified 2-step context (Semester -> Examination Type -> Target Examination)
  const [filterSemesterId, setFilterSemesterId] = useState<string>("");
  const [filterExamType, setFilterExamType] = useState<"REGULAR" | "SUPPLEMENTARY">("REGULAR");
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  // Create Examination Modal State
  const [isCreateExamModalOpen, setIsCreateExamModalOpen] = useState<boolean>(false);
  const [newExamSessionId, setNewExamSessionId] = useState<string>("");
  const [newExamSemesterId, setNewExamSemesterId] = useState<string>("");
  const [newExamType, setNewExamType] = useState<"REGULAR" | "SUPPLEMENTARY">("REGULAR");
  const [newExamName, setNewExamName] = useState<string>("");
  const [newExamDate, setNewExamDate] = useState<string>("");
  const [newExamStatus, setNewExamStatus] = useState<"COMPLETED" | "DRAFT">("COMPLETED");

  // Load Academic Sessions from PostgreSQL (used for creating exams)
  const { data: sessions = [] } = useQuery({
    queryKey: ["academicSessionsList"],
    queryFn: () => academicService.getSessions(),
  });

  // Load Semesters from PostgreSQL
  const { data: semesters = [] } = useQuery({
    queryKey: ["academicSemestersList"],
    queryFn: () => academicService.getSemesters(),
  });

  // Load Real Examinations from PostgreSQL
  const { data: examinations = [] } = useQuery({
    queryKey: ["uploadExaminationsList"],
    queryFn: () => examinationsService.getExaminations(),
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
      if (res.fileType !== "EXAMINATION_RESULT") {
        toast.error(
          `Detected file type is "${res.fileType}". For Student Master Rosters, please use the Upload Students page.`,
          { duration: 5000 }
        );
        return;
      }
      setStagedPreview(res as ExaminationResultPreviewData);
      setImportResult(null);

      // Auto-populate filter context if detected from Excel metadata
      const detectedSemNum =
        res.metadata?.semesterNumber || parseSemesterNumber(res.metadata?.semester);
      let matchedSemId = filterSemesterId;
      if (detectedSemNum && semesters.length > 0) {
        const matchingSem = semesters.find((s) => s.semesterNumber === detectedSemNum);
        if (matchingSem) {
          matchedSemId = matchingSem.id;
          setFilterSemesterId(matchingSem.id);
        }
      }

      const detectedType = (res.metadata?.examType || res.metadata?.examinationType) as
        | ("REGULAR" | "SUPPLEMENTARY")
        | undefined;
      let chosenType = filterExamType;
      if (detectedType) {
        chosenType = detectedType;
        setFilterExamType(detectedType);
      }

      // Filter matching exams for auto-selection
      const candidates = examinations.filter((e) => {
        if (matchedSemId && String(e.semesterId) !== String(matchedSemId)) return false;
        if (chosenType && e.examType !== chosenType) return false;
        return true;
      });

      if (res.metadata?.examinationName && candidates.length > 0) {
        const matchingExam = candidates.find(
          (e) =>
            e.examName.toLowerCase().includes(res.metadata.examinationName.toLowerCase()) ||
            res.metadata.examinationName.toLowerCase().includes(e.examName.toLowerCase())
        );
        if (matchingExam) {
          setSelectedExamId(matchingExam.id);
        } else if (candidates.length === 1) {
          setSelectedExamId(candidates[0].id);
        }
      } else if (candidates.length === 1) {
        setSelectedExamId(candidates[0].id);
      }

      toast.success(
        "Examination results analyzed! Examination context detected and preselected below."
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to parse examination spreadsheet.");
    },
  });

  // Create Examination Mutation
  const createExamMutation = useMutation({
    mutationFn: () => {
      if (!newExamName.trim()) throw new Error("Examination Name is required.");
      if (!newExamSessionId) throw new Error("Academic Session is required.");
      if (!newExamSemesterId) throw new Error("Semester is required.");

      return examinationsService.createExamination({
        examName: newExamName.trim(),
        academicSessionId: newExamSessionId,
        semesterId: newExamSemesterId,
        examType: newExamType,
        examDate: newExamDate || undefined,
        status: newExamStatus,
      });
    },
    onSuccess: (newExam) => {
      toast.success(`Examination "${newExam.examName}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["uploadExaminationsList"] });
      setSelectedExamId(String(newExam.id));
      setIsCreateExamModalOpen(false);
      // Synchronize filter selections
      setFilterSemesterId(String(newExam.semesterId));
      setFilterExamType(newExam.examType);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create examination.");
    },
  });

  // Import Confirmation Mutation
  const importMutation = useMutation({
    mutationFn: () => {
      if (!stagedPreview?.importToken) {
        throw new Error("No valid staged import token found. Please re-upload.");
      }
      if (!selectedExamId) {
        throw new Error("Please select an Examination from the dropdown.");
      }
      return excelUploadService.confirmImport({
        token: stagedPreview.importToken,
        examinationId: Number(selectedExamId),
      });
    },
    onSuccess: (res: any) => {
      setImportResult(res as ExaminationImportResult);
      // Clear token after successful import
      setStagedPreview(null);
      setFile(null);
      refetchHistory();
      toast.success("Examination results successfully normalized and committed into PostgreSQL!");
    },
    onError: (err: any) => {
      if (err.message?.includes("IMPORT_TOKEN_EXPIRED") || err.message?.includes("IMPORT_CONTEXT_EXPIRED")) {
        toast.error("Your import session has expired. Please upload and preview the Excel file again.", {
          duration: 6000,
        });
        setStagedPreview(null);
      } else if (err.message?.includes("SEMESTER_MISMATCH")) {
        toast.error(err.message, { duration: 8000 });
      } else if (err.message?.includes("DUPLICATE_IMPORT")) {
        toast.error("Duplicate file: This exact examination result sheet has already been imported for this exam.", {
          duration: 6000,
        });
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
      "HTNO",
      "STUDENT NAME",
      "CS101 INT",
      "CS101 EXT",
      "CS101 TOT",
      "CS101 GRD",
      "MA101 INT",
      "MA101 EXT",
      "MA101 TOT",
      "MA101 GRD",
      "SGPA",
      "CGPA",
      "RESULT",
    ];
    const sampleRow = [
      "2026CSE01",
      "Rahul Sharma",
      "25",
      "60",
      "85",
      "A+",
      "22",
      "50",
      "72",
      "A",
      "8.50",
      "8.50",
      "PASS",
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), sampleRow.join(",")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "wide_examination_result_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Examinations based on Semester and Examination Type
  const filteredExaminations = examinations.filter((e) => {
    if (filterSemesterId && String(e.semesterId) !== String(filterSemesterId)) return false;
    if (filterExamType && e.examType !== filterExamType) return false;
    return true;
  });

  const selectedSemester = semesters.find((s) => String(s.id) === String(filterSemesterId));
  const sortedSemesters = [...semesters].sort((a, b) => a.semesterNumber - b.semesterNumber);

  // Strict Semester Mismatch Calculation
  const selectedExam = examinations.find((e) => String(e.id) === String(selectedExamId));
  const detectedSemesterNumber =
    stagedPreview?.metadata?.semesterNumber ||
    parseSemesterNumber(stagedPreview?.metadata?.semester);

  const isSemesterMismatch = Boolean(
    stagedPreview &&
      selectedExam &&
      detectedSemesterNumber !== null &&
      selectedExam.semesterNumber !== undefined &&
      selectedExam.semesterNumber !== detectedSemesterNumber
  );

  const handleSemesterChange = (newSemId: string) => {
    setFilterSemesterId(newSemId);
    const matching = examinations.filter(
      (e) => (!newSemId || String(e.semesterId) === String(newSemId)) && e.examType === filterExamType
    );
    if (matching.length === 1) {
      setSelectedExamId(matching[0].id);
    } else {
      setSelectedExamId("");
    }
  };

  const handleExamTypeChange = (newType: "REGULAR" | "SUPPLEMENTARY") => {
    setFilterExamType(newType);
    const matching = examinations.filter(
      (e) => (!filterSemesterId || String(e.semesterId) === String(filterSemesterId)) && e.examType === newType
    );
    if (matching.length === 1) {
      setSelectedExamId(matching[0].id);
    } else {
      setSelectedExamId("");
    }
  };

  // Helper to suggest examination name
  const handleAutoSuggestExamName = (sessionId: string, semesterId: string, type: string) => {
    const sess = sessions.find((s) => String(s.id) === String(sessionId));
    const sem = semesters.find((s) => String(s.id) === String(semesterId));
    if (!sem) return;

    const romanYears: Record<number, string> = {
      1: "I B.Tech",
      2: "II B.Tech",
      3: "III B.Tech",
      4: "IV B.Tech",
    };
    const romanSems: Record<number, string> = {
      1: "I Semester",
      2: "II Semester",
      3: "I Semester",
      4: "II Semester",
      5: "I Semester",
      6: "II Semester",
      7: "I Semester",
      8: "II Semester",
    };

    const yPrefix = romanYears[sem.semesterNumber <= 2 ? 1 : sem.semesterNumber <= 4 ? 2 : sem.semesterNumber <= 6 ? 3 : 4] || "B.Tech";
    const sSuffix = romanSems[sem.semesterNumber] || `Semester ${sem.semesterNumber}`;
    const typeStr = type === "REGULAR" ? "Regular" : "Supplementary";
    const sessYear = sess?.sessionName.split("-")[1] || "2025";

    setNewExamName(`${yPrefix} ${sSuffix} ${typeStr} Examinations July ${sessYear}`);
  };

  // History Columns
  const historyColumns: Column<any>[] = [
    {
      header: "File Name",
      accessor: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
          {row.fileName}
        </span>
      ),
    },
    {
      header: "Examination",
      accessor: (row) => {
        if (row.examinationName) {
          return (
            <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
              {row.examinationName}
            </span>
          );
        }
        if (row.examinationId) {
          return <span className="text-xs text-slate-600 font-mono">Exam #{row.examinationId}</span>;
        }
        return <Badge variant="info">Student Master Roster</Badge>;
      },
    },
    {
      header: "Semester",
      accessor: (row) => {
        if (row.semesterNumber) {
          return (
            <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
              Semester {row.semesterNumber}
            </span>
          );
        }
        if (row.semesterName) {
          return <span className="text-xs text-slate-600">{row.semesterName}</span>;
        }
        return <span className="text-xs text-slate-400">—</span>;
      },
    },
    {
      header: "Type",
      accessor: (row) => {
        if (!row.examType) return <span className="text-xs text-slate-400">—</span>;
        return (
          <Badge variant={row.examType === "REGULAR" ? "info" : "warning"}>
            {row.examType}
          </Badge>
        );
      },
    },
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
    { header: "Failed", accessor: "failedRows" },
    {
      header: "Upload Time",
      accessor: (row) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {row.uploadedAt ? new Date(row.uploadedAt).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-600" /> Import Examination Results (Wide Format)
          </h2>
          <p className="text-xs text-slate-400">
            Dynamically detects wide-format subject headers and normalizes scores into PostgreSQL exam_results.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewExamSessionId(sessions[0]?.id ?? "");
              setNewExamSemesterId(filterSemesterId || (semesters[0]?.id ?? ""));
              setNewExamType(filterExamType);
              handleAutoSuggestExamName(
                sessions[0]?.id ?? "",
                filterSemesterId || (semesters[0]?.id ?? ""),
                filterExamType
              );
              setIsCreateExamModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5 text-primary-500" /> Create Examination
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-2" /> Download Template
          </Button>
        </div>
      </div>

      {/* Step 1: Upload Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              1. Select Result Spreadsheet for Preview
            </h3>
            {previewMutation.isPending && (
              <span className="text-xs text-primary-600 font-semibold animate-pulse">
                Analyzing Excel file & detecting subjects...
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
              Wide format with any number of subjects is dynamically detected and transformed.
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
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3 text-xs text-slate-500 dark:text-slate-400">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary-500" /> Wide Result Rules
          </h3>
          <ul className="space-y-2 list-disc pl-4 leading-relaxed">
            <li>Subject columns are <strong>dynamically detected</strong> from headers (supports Int, Ext, Tot, Grd).</li>
            <li>Supports arbitrary student counts and varying numbers of courses per semester.</li>
            <li>Strict semester validation prevents importing marks into the wrong semester examination.</li>
            <li>Captures <strong>SGPA, CGPA, and Result Status</strong> for semester results table.</li>
            <li>Duplicate uploads for the same examination are blocked by file hash.</li>
          </ul>
        </div>
      </div>

      {/* Step 2: Staged Preview Display & Examination Selection */}
      {stagedPreview && (
        <div className="p-6 bg-white dark:bg-slate-900 border-2 border-primary-500/20 dark:border-primary-500/30 rounded-3xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold text-xs rounded-full uppercase">
                  {stagedPreview.fileType}
                </span>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {stagedPreview.fileName}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Detected Subjects: <strong className="text-slate-700 dark:text-slate-300">{stagedPreview.detectedSubjects.length} courses</strong>
                {stagedPreview.metadata?.semester && (
                  <span className="ml-3">
                    Detected Semester: <strong className="text-primary-600 dark:text-primary-400">{stagedPreview.metadata.semester}</strong>
                  </span>
                )}
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
              <p className="text-[10px] text-slate-400 font-bold uppercase">Total Students</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                {stagedPreview.summary.totalStudents}
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Valid Students</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {stagedPreview.summary.validStudents}
              </p>
            </div>
            <div className="p-4 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/40 rounded-2xl">
              <p className="text-[10px] text-primary-600 dark:text-primary-400 font-bold uppercase">Subject Scores</p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">
                {stagedPreview.summary.totalSubjectScores}
              </p>
            </div>
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-2xl">
              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase">Invalid Rows</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {stagedPreview.summary.invalidStudents}
              </p>
            </div>
          </div>

          {/* Categorized Validation Error Breakdown */}
          {stagedPreview.summary.errorSummary && Object.keys(stagedPreview.summary.errorSummary).length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl space-y-2">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Validation Error Breakdown
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stagedPreview.summary.errorSummary).map(([cat, count], idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5"
                  >
                    <span>{cat}:</span>
                    <strong className="text-amber-900 dark:text-amber-100 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-full text-[11px]">
                      {count}
                    </strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Invalid Rows Table */}
          {stagedPreview.validationErrors && stagedPreview.validationErrors.length > 0 && (
            <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  Invalid Rows Excluded From Import ({stagedPreview.validationErrors.length})
                </span>
                <span className="text-[10px] text-rose-500 font-medium">
                  These rows are skipped; valid rows will be imported safely
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {stagedPreview.validationErrors.map((err, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-800/50 rounded-xl text-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400">Row {err.rowNumber}:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {err.hallTicketNumber || "Unknown"}
                      </span>
                    </div>
                    <span className="text-rose-600 dark:text-rose-400 text-xs font-medium">
                      {err.reason || (err.errors && err.errors.join("; ")) || "Validation failed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detected Subject Badges */}
          <div className="p-4 bg-slate-50 dark:bg-slate-850/50 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Dynamically Detected Subjects ({stagedPreview.detectedSubjects.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {stagedPreview.detectedSubjects.map((s, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs flex items-center gap-2"
                >
                  <BookOpen className="w-3.5 h-3.5 text-primary-500" />
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{s.subjectCode}</span>
                  <div className="flex gap-1 text-[9px] text-slate-400">
                    {s.hasInternal && <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Int</span>}
                    {s.hasExternal && <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Ext</span>}
                    {s.hasTotal && <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Tot</span>}
                    {s.hasGrade && <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Grd</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Dynamic Academic Selection & Target Examination */}
          <div className="p-5 bg-primary-500/5 border border-primary-500/20 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" /> 2. Select Target Examination Context (PostgreSQL)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select the Semester and Examination Type to filter matching examinations.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewExamSessionId(sessions[0]?.id ?? "");
                  setNewExamSemesterId(filterSemesterId || (semesters[0]?.id ?? ""));
                  setNewExamType(filterExamType);
                  handleAutoSuggestExamName(
                    sessions[0]?.id ?? "",
                    filterSemesterId || (semesters[0]?.id ?? ""),
                    filterExamType
                  );
                  setIsCreateExamModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Examination
              </Button>
            </div>

            {/* Auto-Detected Context Visual Confirmation */}
            {(detectedSemesterNumber || stagedPreview.metadata?.examType) && (
              <div className="p-3 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-primary-800 dark:text-primary-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    Detected Context:
                  </span>
                  {detectedSemesterNumber && (
                    <span className="px-2.5 py-0.5 bg-white dark:bg-slate-900 border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 font-bold text-xs rounded-full">
                      Semester {detectedSemesterNumber} ({semesters.find((s) => s.semesterNumber === detectedSemesterNumber)?.semesterName || stagedPreview.metadata?.semester})
                    </span>
                  )}
                  {stagedPreview.metadata?.examType && (
                    <span className="px-2.5 py-0.5 bg-white dark:bg-slate-900 border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 font-bold text-xs rounded-full">
                      {stagedPreview.metadata.examType === "REGULAR" ? "Regular" : "Supplementary"}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-primary-600 dark:text-primary-400 font-medium">
                  Context preselected below. You can change manually if needed.
                </span>
              </div>
            )}

            {/* 2-Step Filter: 1. Semester -> 2. Examination Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                  1. Semester
                </label>
                <Select
                  options={[
                    { label: "Select Semester (Semesters 1 to 8)...", value: "" },
                    ...sortedSemesters.map((s) => ({
                      label: `Semester ${s.semesterNumber} — ${s.semesterName}`,
                      value: String(s.id),
                    })),
                  ]}
                  value={filterSemesterId}
                  onChange={(e) => handleSemesterChange(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                  2. Examination Type
                </label>
                <Select
                  options={[
                    { label: "Regular", value: "REGULAR" },
                    { label: "Supplementary", value: "SUPPLEMENTARY" },
                  ]}
                  value={filterExamType}
                  onChange={(e) => handleExamTypeChange(e.target.value as "REGULAR" | "SUPPLEMENTARY")}
                />
              </div>
            </div>

            {/* Target Examination Selection or Empty State */}
            <div className="pt-2">
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                3. Target Examination <span className="text-rose-500">*</span>
              </label>

              {filteredExaminations.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      No examinations found for {selectedSemester ? `Semester ${selectedSemester.semesterNumber}` : "this semester"}{" "}
                      ({filterExamType === "REGULAR" ? "Regular" : "Supplementary"}). Create an examination or check your filters.
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setNewExamSessionId(sessions[0]?.id ?? "");
                      setNewExamSemesterId(filterSemesterId || (semesters[0]?.id ?? ""));
                      setNewExamType(filterExamType);
                      handleAutoSuggestExamName(
                        sessions[0]?.id ?? "",
                        filterSemesterId || (semesters[0]?.id ?? ""),
                        filterExamType
                      );
                      setIsCreateExamModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Create Examination
                  </Button>
                </div>
              ) : (
                <Select
                  options={[
                    { label: "Select Target Examination...", value: "" },
                    ...filteredExaminations.map((e) => ({
                      label: `${e.examName} (${e.sessionName || "Academic Session"} • ${e.status})`,
                      value: String(e.id),
                    })),
                  ]}
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                />
              )}
            </div>

            {/* Strict Semester Mismatch Alert */}
            {isSemesterMismatch && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                <div className="text-xs text-rose-700 dark:text-rose-300 space-y-1">
                  <p className="font-bold text-sm">Strict Semester Mismatch Detected (Import Blocked)</p>
                  <p>
                    The uploaded spreadsheet contains results for <strong>Semester {detectedSemesterNumber}</strong>{" "}
                    ({stagedPreview?.metadata?.semester}), but the selected examination{" "}
                    <strong>"{selectedExam?.examName}"</strong> is configured for <strong>Semester {selectedExam?.semesterNumber}</strong>{" "}
                    ({selectedExam?.semesterName}).
                  </p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">
                    To maintain strict database integrity, cross-semester imports are blocked. Please select or create the matching Semester {detectedSemesterNumber} examination.
                  </p>
                </div>
              </div>
            )}

            {/* Semester Ambiguity Advisory */}
            {!isSemesterMismatch && detectedSemesterNumber === null && stagedPreview && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Semester metadata could not be confidently identified from spreadsheet headers. Please ensure the target examination context matches your data.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-primary-500/20">
              <Button variant="outline" size="sm" onClick={() => setStagedPreview(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => importMutation.mutate()}
                disabled={!selectedExamId || isSemesterMismatch || importMutation.isPending}
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
            <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Results Successfully Imported
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Spreadsheet <strong>{importResult.fileName}</strong> results committed for examination: <strong>{importResult.examinationName}</strong>.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Students Processed</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                {importResult.studentsProcessed}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Subject Scores Inserted</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">
                {importResult.resultsInserted}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <p className="text-[10px] font-bold text-primary-600 uppercase">Semester Summaries</p>
              <p className="text-xl font-bold text-primary-600 mt-0.5">
                {importResult.semesterSummariesInserted}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <p className="text-[10px] font-bold text-amber-600 uppercase">Duplicate Skipped</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">
                {importResult.resultsSkipped}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Upload Audit History */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-primary-600" /> Recent Examination Upload Audit History
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

      {/* Modal: Create Examination Dialog */}
      <Modal
        isOpen={isCreateExamModalOpen}
        onClose={() => setIsCreateExamModalOpen(false)}
        title="Create Examination Record (PostgreSQL)"
        size="md"
      >
        <div className="space-y-4 text-xs text-left">
          <p className="text-slate-500 dark:text-slate-400">
            Create an authoritative examination record for any semester and academic session.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                Academic Session <span className="text-rose-500">*</span>
              </label>
              <Select
                options={sessions.map((s) => ({ label: s.sessionName, value: s.id }))}
                value={newExamSessionId}
                onChange={(e) => {
                  setNewExamSessionId(e.target.value);
                  handleAutoSuggestExamName(e.target.value, newExamSemesterId, newExamType);
                }}
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                Semester <span className="text-rose-500">*</span>
              </label>
              <Select
                options={semesters.map((s) => ({
                  label: `${s.semesterName} (Semester ${s.semesterNumber})`,
                  value: s.id,
                }))}
                value={newExamSemesterId}
                onChange={(e) => {
                  setNewExamSemesterId(e.target.value);
                  handleAutoSuggestExamName(newExamSessionId, e.target.value, newExamType);
                }}
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                Examination Type <span className="text-rose-500">*</span>
              </label>
              <Select
                options={[
                  { label: "Regular Examination", value: "REGULAR" },
                  { label: "Supplementary Examination", value: "SUPPLEMENTARY" },
                ]}
                value={newExamType}
                onChange={(e) => {
                  const t = e.target.value as "REGULAR" | "SUPPLEMENTARY";
                  setNewExamType(t);
                  handleAutoSuggestExamName(newExamSessionId, newExamSemesterId, t);
                }}
              />
            </div>

            <div>
              <Input
                label="Examination Title"
                placeholder="e.g. II B.Tech II Semester Regular Examinations July 2025"
                value={newExamName}
                onChange={(e) => setNewExamName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  label="Examination Date"
                  type="date"
                  value={newExamDate}
                  onChange={(e) => setNewExamDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                  Status
                </label>
                <Select
                  options={[
                    { label: "Completed", value: "COMPLETED" },
                    { label: "Draft", value: "DRAFT" },
                  ]}
                  value={newExamStatus}
                  onChange={(e) => setNewExamStatus(e.target.value as "COMPLETED" | "DRAFT")}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateExamModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => createExamMutation.mutate()}
              isLoading={createExamMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Save Examination
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default MarksUpload;
