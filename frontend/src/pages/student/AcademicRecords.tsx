import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "../../api/student.api";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { LoadingScreen } from "../../components/shared/LoadingScreen";

export const AcademicRecords: React.FC = () => {
  const [semester, setSemester] = useState<string>("");

  const { data: response, isLoading } = useQuery({
    queryKey: ["studentMarks", semester],
    queryFn: () => studentApi.getMarks(semester),
  });

  if (isLoading) return <LoadingScreen />;

  const marksData = (response?.data ?? { marks: [], summary: [] }) as {
    marks?: any[];
    summary?: any[];
  };
  const marks = marksData.marks || [];
  const summaries = marksData.summary || [];

  const columns: Column<any>[] = [
    { header: "Subject Code", accessor: "subjectCode" },
    { header: "Subject Name", accessor: "subjectName" },
    { header: "Internal", accessor: "internalMarks" },
    { header: "External", accessor: "externalMarks" },
    { header: "Total", accessor: "totalMarks" },
    { header: "Grade", accessor: "grade" },
    { header: "Credits", accessor: "credits" },
    {
      header: "Result",
      accessor: (row) => (
        <Badge variant={row.result === "Pass" ? "success" : "danger"}>
          {row.result}
        </Badge>
      ),
    },
  ];

  const semesterOptions = [
    { label: "All Semesters", value: "" },
    { label: "1-1", value: "1-1" },
    { label: "1-2", value: "1-2" },
    { label: "2-1", value: "2-1" },
    { label: "2-2", value: "2-2" },
    { label: "3-1", value: "3-1" },
    { label: "3-2", value: "3-2" },
    { label: "4-1", value: "4-1" },
    { label: "4-2", value: "4-2" },
  ];

  // Most recent summary for display
  const latestSummary =
    summaries.length > 0 ? summaries[summaries.length - 1] : null;

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Academic Records
          </h2>
          <p className="text-xs text-slate-400">
            View your semester-wise grades, marks, and SGPA/CGPA history
            details.
          </p>
        </div>
      </div>

      {/* Filter and summary banner */}
      <div className="flex flex-col md:flex-row gap-6 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm justify-between items-start md:items-center">
        <div className="w-48">
          <Select
            options={semesterOptions}
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            label="Semester Filter"
            id="student-marks-sem-select"
          />
        </div>

        {latestSummary && (
          <div className="flex items-center gap-6 text-xs bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">
                Latest SGPA
              </p>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                {latestSummary.sgpa}
              </p>
            </div>
            <div className="border-l border-slate-200 dark:border-slate-700 h-6 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">
                Cumulative CGPA
              </p>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                {latestSummary.cgpa}
              </p>
            </div>
            <div className="border-l border-slate-200 dark:border-slate-700 h-6 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">
                Total Credits
              </p>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                {latestSummary.totalCredits}
              </p>
            </div>
          </div>
        )}
      </div>

      <Table
        columns={columns}
        data={marks}
        isLoading={false}
        emptyMessage="No marks uploaded yet. Contact Department Admin."
        id="student-marks-table"
      />
    </div>
  );
};
