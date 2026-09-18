import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  GraduationCap,
  Award,
  AlertCircle,
  TrendingUp,
  Building2,
} from "lucide-react";
import { analyticsService } from "../../services/analytics.service";
import { academicService } from "../../services/academic.service";
import { BarChartCard } from "../../components/charts/BarChartCard";
import { PieChartCard } from "../../components/charts/PieChartCard";
import { Select } from "../../components/ui/Select";
import { LoadingScreen } from "../../components/shared/LoadingScreen";

export const AdminAnalytics: React.FC = () => {
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [semesterFilter, setSemesterFilter] = useState<string>("");
  const [sessionFilter, setSessionFilter] = useState<string>("");

  // Load real departments from PostgreSQL
  const { data: departments = [] } = useQuery({
    queryKey: ["analyticsDepartmentsList"],
    queryFn: () => academicService.getDepartments(),
  });

  // Load real semesters from PostgreSQL
  const { data: semesters = [] } = useQuery({
    queryKey: ["analyticsSemestersList"],
    queryFn: () => academicService.getSemesters(),
  });

  // Load real academic sessions from PostgreSQL
  const { data: sessions = [] } = useQuery({
    queryKey: ["analyticsSessionsList"],
    queryFn: () => academicService.getSessions(),
  });

  // Fetch real PostgreSQL overview analytics with dynamic filters
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["adminAnalyticsOverview", departmentFilter, semesterFilter, sessionFilter],
    queryFn: () =>
      analyticsService.getOverview({
        departmentId: departmentFilter || undefined,
        semesterId: semesterFilter || undefined,
        academicSessionId: sessionFilter || undefined,
      }),
  });

  // Fetch department-level breakdown
  const { data: deptData = [] } = useQuery({
    queryKey: ["adminAnalyticsDeptBreakdown"],
    queryFn: () => analyticsService.getDepartments(),
  });

  if (isLoading) return <LoadingScreen />;

  const totalStudents = analytics?.totalStudents ?? 0;
  const studentsWithResults = analytics?.studentsWithResults ?? 0;
  const passPercentage = analytics?.passPercentage;
  const averageSGPA = analytics?.averageSGPA;
  const averageCGPA = analytics?.averageCGPA;

  // Real CGPA Distribution data for BarChart
  const cgpaSource = analytics?.cgpaDistribution ?? {};
  const cgpaData = Object.keys(cgpaSource).map((key) => ({
    range: key,
    count: Number(cgpaSource[key] ?? 0),
  }));

  // Real Backlog Distribution data for PieChart
  const backlogSource = analytics?.backlogDistribution ?? {
    zeroBacklogs: 0,
    oneBacklog: 0,
    twoBacklogs: 0,
    threeOrMoreBacklogs: 0,
    totalBacklogStudents: 0,
  };
  const backlogData = [
    { name: "0 Backlogs (Clear)", value: backlogSource.zeroBacklogs },
    { name: "1 Backlog", value: backlogSource.oneBacklog },
    { name: "2 Backlogs", value: backlogSource.twoBacklogs },
    { name: "3+ Backlogs", value: backlogSource.threeOrMoreBacklogs },
  ].filter((item) => item.value > 0 || studentsWithResults > 0);

  // Filter dropdown options
  const departmentOptions = [
    { label: "All Departments", value: "" },
    ...departments.map((d: any) => ({
      label: `${d.departmentCode} - ${d.departmentName}`,
      value: String(d.id),
    })),
  ];

  const semesterOptions = [
    { label: "All Semesters", value: "" },
    ...semesters.map((s: any) => ({
      label: s.semesterName || `Semester ${s.semesterNumber}`,
      value: String(s.id),
    })),
  ];

  const sessionOptions = [
    { label: "All Academic Sessions", value: "" },
    ...sessions.map((sess: any) => ({
      label: sess.sessionName,
      value: String(sess.id),
    })),
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Institutional Analytics
          </h2>
          <p className="text-xs text-slate-400">
            PostgreSQL-computed performance indicators, active backlog tracking, and CGPA distributions.
          </p>
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="w-full sm:w-56">
          <Select
            options={departmentOptions}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            label="Department"
            id="analytics-dept-filter"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={semesterOptions}
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            label="Semester"
            id="analytics-sem-filter"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            options={sessionOptions}
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            label="Academic Session"
            id="analytics-session-filter"
          />
        </div>
      </div>

      {/* Zero Results Notification Banner */}
      {studentsWithResults === 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-600 dark:text-amber-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold">No Examination Results Imported: </span>
            {analytics?.statusMessage || "Upload examination spreadsheets via the Marks Upload portal to view live grade curves and pass rates."}
          </div>
        </div>
      )}

      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary-500" /> Total Students
          </p>
          <p className="text-2xl font-bold text-slate-850 dark:text-slate-200 mt-1">
            {totalStudents}
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-emerald-500" /> Students With Results
          </p>
          <p className="text-2xl font-bold text-slate-850 dark:text-slate-200 mt-1">
            {studentsWithResults}
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-sky-500" /> Overall Pass Rate
          </p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">
            {passPercentage !== null ? `${passPercentage}%` : "N/A"}
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-500" /> Average SGPA / CGPA
          </p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {averageSGPA !== null ? `${averageSGPA} / 10` : (averageCGPA !== null ? `${averageCGPA} / 10` : "N/A")}
          </p>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BarChartCard
          title="CGPA Bucket Distribution"
          data={cgpaData}
          xKey="range"
          yKey="count"
          color="#6366F1"
          id="cgpa-distribution-chart"
        />

        <PieChartCard
          title="Active Backlog Analysis"
          data={backlogData.length > 0 ? backlogData : [{ name: "No Backlog Data", value: 1 }]}
          colors={["#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]}
          id="backlog-distribution-chart"
        />
      </div>

      {/* Department Breakdown Table Card */}
      {deptData.length > 0 && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary-500" /> Department Performance Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase">
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-center">Total Students</th>
                  <th className="py-2.5 px-3 text-center">Appeared</th>
                  <th className="py-2.5 px-3 text-center">Passed</th>
                  <th className="py-2.5 px-3 text-center">Failed</th>
                  <th className="py-2.5 px-3 text-center">Pass %</th>
                  <th className="py-2.5 px-3 text-center">Avg SGPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {deptData.map((d) => (
                  <tr key={d.departmentId} className="hover:bg-slate-50 dark:hover:bg-slate-850/50">
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {d.departmentCode} — {d.departmentName}
                    </td>
                    <td className="py-3 px-3 text-center">{d.totalStudents}</td>
                    <td className="py-3 px-3 text-center">{d.studentsWithResults}</td>
                    <td className="py-3 px-3 text-center text-emerald-600 font-bold">{d.passedStudents}</td>
                    <td className="py-3 px-3 text-center text-rose-500 font-bold">{d.failedStudents}</td>
                    <td className="py-3 px-3 text-center font-bold">
                      {d.passPercentage !== null ? `${d.passPercentage}%` : "—"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {d.averageSGPA !== null ? d.averageSGPA : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
