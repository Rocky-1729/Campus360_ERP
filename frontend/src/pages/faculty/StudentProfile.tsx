import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Clock,
  Activity,
} from "lucide-react";
import { studentsService } from "../../services/students.service";
import { resultsService } from "../../services/results.service";
import { academicService } from "../../services/academic.service";
import { LoadingScreen } from "../../components/shared/LoadingScreen";
import { Button } from "../../components/ui/Button";
import { Tabs } from "../../components/ui/Tabs";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Select } from "../../components/ui/Select";
import { StudentProfileCard } from "../../components/shared/StudentProfileCard";

export const StudentProfile: React.FC = () => {
  const { hallTicket } = useParams<{ hallTicket: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("personal");
  const [semFilter, setSemFilter] = useState<string>("");

  const {
    data: studentData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["assignedStudentProfile", hallTicket],
    queryFn: () => studentsService.getStudentById(hallTicket!),
    enabled: !!hallTicket,
    retry: false,
  });

  const { data: resultsData, isLoading: isResultsLoading } = useQuery({
    queryKey: ["studentResultsHistory", hallTicket],
    queryFn: () => resultsService.getStudentResults(hallTicket!),
    enabled: !!hallTicket,
  });

  const { data: dbSemesters = [] } = useQuery({
    queryKey: ["academicSemestersList"],
    queryFn: () => academicService.getSemesters(),
  });

  if (isLoading) return <LoadingScreen />;

  if (isError || !studentData) {
    return (
      <div className="text-center py-12 space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          Error Loading Student
        </h3>
        <p className="text-sm text-slate-500">
          Student with hall ticket "{hallTicket}" was not found in the database.
        </p>
        <Button variant="primary" onClick={() => navigate("/faculty/students")}>
          Back to list
        </Button>
      </div>
    );
  }

  const student: any = studentData;
  const profile: any = {
    ...student,
    student,
    marks: student?.marks || [],
    timeline: student?.timeline || [],
  };
  const attendanceSummary = student?.attendanceSummary ?? {
    percentage: 0,
    present: 0,
    total: 0,
    subjectWise: [],
  };

  const tabOptions = [
    {
      id: "personal",
      label: "Personal Info",
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      id: "academic",
      label: "Academic Records",
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: "attendance",
      label: "Attendance",
      icon: <Clock className="w-4 h-4" />,
    },
    {
      id: "timeline",
      label: "Timeline History",
      icon: <Activity className="w-4 h-4" />,
    },
  ];

  const marksColumns: Column<any>[] = [
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

  const attendanceColumns: Column<any>[] = [
    { header: "Subject", accessor: "subjectName" },
    { header: "Total Classes", accessor: "total" },
    { header: "Present", accessor: "present" },
    { header: "Absent", accessor: "absent" },
    { header: "Late", accessor: "late" },
    {
      header: "Percentage",
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden shrink-0">
            <div
              className={`h-2 rounded-full ${
                row.percentage >= 75 ? "bg-emerald-500" : "bg-rose-500"
              }`}
              style={{ width: `${Math.min(row.percentage, 100)}%` }}
            />
          </div>
          <span
            className={`font-semibold ${row.percentage >= 75 ? "text-emerald-500" : "text-rose-500"}`}
          >
            {row.percentage}%
          </span>
        </div>
      ),
    },
  ];

  const semesterOptions = [
    { label: "All Semesters", value: "" },
    ...dbSemesters.map((s: any) => ({
      label: s.semesterName || `Semester ${s.semesterNumber}`,
      value: String(s.id),
    })),
  ];

  const studentResults = resultsData?.results || [];
  const filteredExamResults = semFilter
    ? studentResults.filter(
        (r) =>
          String(r.semester.id) === semFilter ||
          r.semester.semesterName === semFilter ||
          String(r.semester.semesterNumber) === semFilter
      )
    : studentResults;

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/faculty/students")}
          id="btn-back-roster"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Roster
        </Button>
      </div>

      <StudentProfileCard student={student} />

      <Tabs
        tabs={tabOptions}
        activeTab={activeTab}
        onChange={setActiveTab}
        id="student-search-tabs"
      />

      {/* Info Tabs panels */}
      {activeTab === "personal" && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Family Contacts
            </h3>
            <div className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
              <p>
                <strong>Father Name:</strong> {student.fatherName || "N/A"}
              </p>
              <p>
                <strong>Mother Name:</strong> {student.motherName || "N/A"}
              </p>
              <p>
                <strong>Mobile Number:</strong> {student.mobile || "N/A"}
              </p>
              <p>
                <strong>Official Email:</strong> {student.email || "N/A"}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Identity Details
            </h3>
            <div className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
              <p>
                <strong>Aadhaar Number:</strong>{" "}
                {student.aadhaarNumber || "N/A"}
              </p>
              <p>
                <strong>ABC ID:</strong> {profile.student?.abcId || student.abcId || "N/A"}
              </p>
              <p>
                <strong>Gender:</strong> {profile.student?.gender || student.gender || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "academic" && (
        <div className="space-y-6">
          <div className="w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-sm">
            <Select
              options={semesterOptions}
              value={semFilter}
              onChange={(e) => setSemFilter(e.target.value)}
              placeholder="All Semesters"
              id="academic-sem-filter"
            />
          </div>

          {isResultsLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading academic results...</div>
          ) : filteredExamResults.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No Academic Examination Results Found
              </p>
              <p className="text-xs text-slate-400">
                No examination results have been imported into PostgreSQL for this student.
              </p>
            </div>
          ) : (
            filteredExamResults.map((examResult) => (
              <div
                key={examResult.examination.id}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      {examResult.examination.examName}
                      <Badge
                        variant={
                          examResult.examination.examType === "REGULAR" ? "info" : "warning"
                        }
                      >
                        {examResult.examination.examType}
                      </Badge>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {examResult.semester.semesterName} • {examResult.academicSession.sessionName}
                    </p>
                  </div>

                  {examResult.summary && (
                    <div className="flex items-center gap-4 text-xs">
                      {examResult.summary.sgpa !== null && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold">SGPA</span>
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {examResult.summary.sgpa}
                          </p>
                        </div>
                      )}
                      {examResult.summary.cgpa !== null && (
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold">CGPA</span>
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {examResult.summary.cgpa}
                          </p>
                        </div>
                      )}
                      {examResult.summary.overallResult && (
                        <Badge
                          variant={
                            examResult.summary.overallResult === "PASS"
                              ? "success"
                              : examResult.summary.overallResult === "FAIL"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {examResult.summary.overallResult}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <Table
                  columns={marksColumns}
                  data={examResult.subjects}
                  isLoading={false}
                  emptyMessage="No subject marks recorded for this examination."
                  id={`student-marks-exam-${examResult.examination.id}`}
                />
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-800">
              <span
                className={`text-lg font-bold ${
                  attendanceSummary.percentage >= 75
                    ? "text-emerald-500"
                    : "text-rose-500"
                }`}
              >
                {attendanceSummary.percentage}%
              </span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Overall Attendance
              </h4>
              <p className="text-xs text-slate-450 mt-1">
                Present for {attendanceSummary.present} class(es) out of{" "}
                {attendanceSummary.total} total sessions.
              </p>
            </div>
          </div>

          {/* Subject Breakdown */}
          <Table
            columns={attendanceColumns}
            data={attendanceSummary?.subjectWise || []}
            isLoading={false}
            emptyMessage="No attendance records registered"
            id="student-search-attendance"
          />
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-850 dark:text-slate-200">
              Academic & Activity Timeline
            </h3>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              {profile.timeline?.length || 0} events
            </span>
          </div>

          <div className="relative border-l border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-6">
            {!profile.timeline || profile.timeline.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 pl-2">
                No timeline activities recorded yet.
              </p>
            ) : (
              profile.timeline.map((event: any, idx: number) => (
                <div key={idx} className="relative">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                      event.type === "admission"
                        ? "bg-sky-500"
                        : event.type === "academic"
                          ? "bg-emerald-500"
                          : event.type === "certificate"
                            ? "bg-purple-500"
                            : "bg-amber-500"
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {event.title}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {(() => {
                          try {
                            const d = new Date(event.date);
                            return isNaN(d.getTime())
                              ? event.date
                              : d.toLocaleDateString();
                          } catch {
                            return event.date;
                          }
                        })()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
