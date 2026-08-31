import React from "react";
import { User, Mail, Phone, Calendar, Hash, ShieldCheck } from "lucide-react";
import type { Student } from "../../types/student.types";

interface StudentProfileCardProps {
  student: Student;
}

export const StudentProfileCard: React.FC<StudentProfileCardProps> = ({
  student,
}) => {
  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm text-left">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Profile Avatar */}
        <div className="w-24 h-24 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-3xl border border-primary-500/20 shrink-0">
          {student.name.slice(0, 2).toUpperCase()}
        </div>

        {/* Profile Details Grid */}
        <div className="flex-1 w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="text-center md:text-left">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {student.name}
              </h2>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                {student.department} Department • Section {student.section} •
                Year {student.year}
              </p>
            </div>
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 text-xs font-bold rounded-full border border-primary-200/50 dark:border-primary-800/40 uppercase">
                <Hash className="w-3.5 h-3.5" />
                {student.hallTicketNumber}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  Email
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-250 truncate">
                  {student.email || "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  Phone
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-250">
                  {student.mobile || "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  DOB
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-250">
                  {(() => {
                    if (!student.dateOfBirth) return "N/A";

                    // Try parsing DD/MM/YYYY format first (common from Excel sheets)
                    const parts = student.dateOfBirth.split(/[\/\-]/);
                    if (parts.length === 3) {
                      const day = parseInt(parts[0], 10);
                      const month = parseInt(parts[1], 10) - 1; // 0-indexed month
                      const year = parseInt(parts[2], 10);
                      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        const date = new Date(year, month, day);
                        if (!isNaN(date.getTime())) {
                          return date.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          });
                        }
                      }
                    }

                    // Fallback to standard parsing
                    const parsed = new Date(student.dateOfBirth);
                    if (!isNaN(parsed.getTime())) {
                      return parsed.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });
                    }

                    // Final fallback: return the raw string
                    return student.dateOfBirth;
                  })()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  Father's Name
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-250">
                  {student.fatherName || "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  Mother's Name
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-250">
                  {student.motherName || "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  Aadhaar / ABC ID
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-250">
                  {student.aadhaarNumber
                    ? `XXXX-XXXX-${student.aadhaarNumber.slice(-4)}`
                    : "N/A"}{" "}
                  {student.abcId ? `/ ${student.abcId}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
