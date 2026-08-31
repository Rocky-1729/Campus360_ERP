import React from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, BookOpen, Clock, Bell, User } from "lucide-react";
import { Link } from "react-router-dom";
import { studentApi } from "../../api/student.api";
import { StatsCard } from "../../components/shared/StatsCard";
import { LoadingScreen } from "../../components/shared/LoadingScreen";

export const StudentDashboard: React.FC = () => {
  const { data: response, isLoading } = useQuery({
    queryKey: ["studentDashboard"],
    queryFn: () => studentApi.getDashboard(),
  });

  if (isLoading) return <LoadingScreen />;

  const stats = (response?.data ?? {
    studentName: "Student",
    hallTicketNumber: "",
    currentSgpa: 0,
    currentCgpa: 0,
    overallAttendance: 0,
    recentNotifications: [],
    timeline: [],
  }) as any;

  return (
    <div className="space-y-6 text-left">
      {/* Welcome Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-xl font-bold">Hello, {stats.studentName}</h2>
        <p className="text-xs text-slate-400 mt-1">
          Welcome to your Campus360 Student portal. HT Number:{" "}
          {stats.hallTicketNumber}
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Current SGPA"
          value={stats.currentSgpa || "N/A"}
          icon={<GraduationCap className="w-5 h-5" />}
          description="Most recent semester SGPA"
          id="student-stat-sgpa"
        />
        <StatsCard
          title="Cumulative CGPA"
          value={stats.currentCgpa || "N/A"}
          icon={<BookOpen className="w-5 h-5" />}
          description="Cumulative GPA across sem 1-1 to now"
          id="student-stat-cgpa"
        />
        <StatsCard
          title="Overall Attendance"
          value={stats.overallAttendance ? `${stats.overallAttendance}%` : "0%"}
          icon={<Clock className="w-5 h-5" />}
          description="Overall registered presence percentage"
          className={stats.overallAttendance < 75 ? "border-rose-500" : ""}
          id="student-stat-attendance"
        />
      </div>

      {/* Bottom Grid for announcements and timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications list */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-left space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Bell className="w-4.5 h-4.5 text-primary-500 animate-bounce" />{" "}
              Recent Announcements
            </h3>
            <Link
              to="/student/notifications"
              className="text-[10px] text-primary-600 dark:text-primary-400 font-bold hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-850">
            {stats.recentNotifications.length === 0 ? (
              <p className="text-xs text-center py-6 text-slate-400">
                No recent announcements posted.
              </p>
            ) : (
              stats.recentNotifications.map((notif: any) => (
                <div key={notif._id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-xs font-semibold text-slate-850 dark:text-slate-200">
                      {notif.title}
                    </h4>
                    <span className="text-[9px] text-slate-400 shrink-0">
                      {new Date(notif.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-455 mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                    Sent by: {notif.senderName}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-left space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <User className="w-4.5 h-4.5 text-primary-500" /> Academic &
              Activity Timeline
            </h3>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              {stats.timeline?.length || 0} events
            </span>
          </div>

          <div className="relative border-l border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
            {!stats.timeline || stats.timeline.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 pl-2">
                No timeline activities recorded yet.
              </p>
            ) : (
              stats.timeline.map((event: any, idx: number) => (
                <div key={idx} className="relative">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 ${
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
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
