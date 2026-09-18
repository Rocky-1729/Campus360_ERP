import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { resultsService } from "../../services/results.service";
import { academicService } from "../../services/academic.service";
import { useAuthStore } from "../../store/authStore";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { LoadingScreen } from "../../components/shared/LoadingScreen";

export const AcademicRecords: React.FC = () => {
  const [semester, setSemester] = useState<string>("");
  const user = useAuthStore((s) => s.user);

  // Authenticated student's hall ticket number
  const hallTicket = user?.username || "";

  // Load real semesters from PostgreSQL
  const { data: dbSemesters = [] } = useQuery({
    queryKey: ["studentViewSemesters"],
    queryFn: () => academicService.getSemesters(),
  });

  // Fetch student's real examination results from PostgreSQL
  const { data: resultsData, isLoading } = useQuery({
    queryKey: ["myStudentAcademicRecords", hallTicket],
    queryFn: () => resultsService.getStudentResults(hallTicket),
    enabled: !!hallTicket,
  });

  if (isLoading) return <LoadingScreen />;

  const examResults = resultsData?.results || [];

  // Filter exam results by selected semester
  const filteredExamResults = semester
    ? examResults.filter(
        (r) =>
          String(r.semester.id) === semester ||
          r.semester.semesterName === semester ||
          String(r.semester.semesterNumber) === semester
      )
    : examResults;

  // Flatten subject marks for the table
  const marks = filteredExamResults.flatMap((er) =>
    er.subjects.map((sub) => ({
      ...sub,
      examName: er.examination.examName,
      examType: er.examination.examType,
      semesterName: er.semester.semesterName,
    }))
  );

  // Derive most recent semester summary
  const latestSummary =
    filteredExamResults.length > 0
      ? filteredExamResults[filteredExamResults.length - 1].summary
      : examResults.length > 0
      ? examResults[examResults.length - 1].summary
      : null;

  const columns: Column<any>[] = [
    { header: "Subject Code", accessor: "subjectCode" },
    { header: "Subject Name", accessor: "subjectName" },
    { header: "Internal", accessor: (r) => (r.internalMarks != null ? r.internalMarks : "—") },
    { header: "External", accessor: (r) => (r.externalMarks != null ? r.externalMarks : "—") },
    { header: "Total", accessor: (r) => (r.totalMarks != null ? r.totalMarks : "—") },
    { header: "Grade", accessor: (r) => r.grade || "—" },
    { header: "Credits", accessor: (r) => (r.credits != null ? r.credits : "—") },
    {
      header: "Result",
      accessor: (row) => {
        const res = row.resultStatus || row.result || "N/A";
        const isPass = res.toUpperCase() === "PASS";
        return (
          <Badge variant={isPass ? "success" : "danger"}>
            {res}
          </Badge>
        );
      },
    },
  ];

  const semesterOptions = [
    { label: "All Semesters", value: "" },
    ...dbSemesters.map((s: any) => ({
      label: s.semesterName || `Semester ${s.semesterNumber}`,
      value: String(s.id),
    })),
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Academic Records
          </h2>
          <p className="text-xs text-slate-400">
            View your semester-wise grades, marks, and SGPA/CGPA history details from PostgreSQL.
          </p>
        </div>
        {hallTicket && (
          <span className="text-xs font-mono font-semibold px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
            Hall Ticket: {hallTicket}
          </span>
        )}
      </div>

      {/* Filter and summary banner */}
      <div className="flex flex-col md:flex-row gap-6 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm justify-between items-start md:items-center">
        <div className="w-56">
          <Select
            options={semesterOptions}
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            label="Semester Filter"
            id="student-marks-sem-select"
          />
        </div>

        {latestSummary ? (
          <div className="flex items-center gap-6 text-xs bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">
                Latest SGPA
              </p>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                {latestSummary.sgpa !== null ? `${latestSummary.sgpa} / 10` : "—"}
              </p>
            </div>
            <div className="border-l border-slate-200 dark:border-slate-700 h-6 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">
                Cumulative CGPA
              </p>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                {latestSummary.cgpa !== null ? `${latestSummary.cgpa} / 10` : "—"}
              </p>
            </div>
            <div className="border-l border-slate-200 dark:border-slate-700 h-6 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">
                Credits Earned
              </p>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                {latestSummary.earnedCredits !== null ? latestSummary.earnedCredits : (latestSummary.totalCredits || "—")}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">
            {marks.length === 0 ? "No semester summary available." : ""}
          </span>
        )}
      </div>

      <Table
        columns={columns}
        data={marks}
        isLoading={false}
        emptyMessage="No academic examination marks found in the database. Contact your Department Administrator."
        id="student-marks-table"
      />
    </div>
  );
};
