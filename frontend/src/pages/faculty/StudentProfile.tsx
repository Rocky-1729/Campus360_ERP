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
import { facultyApi } from "../../api/faculty.api";
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
    data: response,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["assignedStudentProfile", hallTicket],
    queryFn: () => facultyApi.getStudentProfile(hallTicket!),
    enabled: !!hallTicket,
    retry: false,
  });

  if (isLoading) return <LoadingScreen />;

  if (isError || !response?.data) {
    return (
      <div className="text-center py-12 space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          Error Loading Student
        </h3>
        <p className="text-sm text-slate-500">
          You may not be authorized to view this student profile or student
          doesn't exist.
        </p>
        <Button variant="primary" onClick={() => navigate("/faculty/students")}>
          Back to list
        </Button>
      </div>
    );
  }

  const profile: any = response.data;
  const student = profile?.student ?? profile ?? {};
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
    { label: "1-1", value: "1-1" },
    { label: "1-2", value: "1-2" },
    { label: "2-1", value: "2-1" },
    { label: "2-2", value: "2-2" },
    { label: "3-1", value: "3-1" },
    { label: "3-2", value: "3-2" },
    { label: "4-1", value: "4-1" },
    { label: "4-2", value: "4-2" },
  ];

  const filteredMarks = profile.marks
    ? profile.marks.filter((m: any) => !semFilter || m.semester === semFilter)
    : [];

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
                <strong>ABC ID:</strong> {profile.student.abcId || "N/A"}
              </p>
              <p>
                <strong>Gender:</strong> {profile.student.gender || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "academic" && (
        <div className="space-y-4">
          <div className="w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-sm">
            <Select
              options={semesterOptions}
              value={semFilter}
              onChange={(e) => setSemFilter(e.target.value)}
              placeholder="All Semesters"
              id="academic-sem-filter"
            />
          </div>

          <Table
            columns={marksColumns}
            data={filteredMarks}
            isLoading={false}
            emptyMessage="No marks uploaded for this student"
            id="student-search-marks"
          />
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
                          } catch (e) {
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
