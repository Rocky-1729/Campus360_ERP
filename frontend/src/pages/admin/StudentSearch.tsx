import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  GraduationCap,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  Filter,
  Users,
  Building2,
} from "lucide-react";
import { studentsService } from "../../services/students.service";
import type { StudentListItem } from "../../services/students.service";
import { academicService } from "../../services/academic.service";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Tabs } from "../../components/ui/Tabs";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { StudentProfileCard } from "../../components/shared/StudentProfileCard";

export const StudentSearch: React.FC = () => {
  // Filter States
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [programId, setProgramId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Selected student for detail view
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("personal");

  // Fetch Academic Filters Dynamically from PostgreSQL
  const { data: departments = [] } = useQuery({
    queryKey: ["academicDepartments"],
    queryFn: () => academicService.getDepartments(),
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["academicPrograms", departmentId],
    queryFn: () => academicService.getPrograms(departmentId || undefined),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["academicBatches", programId],
    queryFn: () => academicService.getBatches(programId || undefined),
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["academicSections", batchId],
    queryFn: () => academicService.getSections(batchId || undefined),
  });

  // Fetch Overall Database Counts
  const { data: statusCounts } = useQuery({
    queryKey: ["studentStatusCounts"],
    queryFn: () => studentsService.getStatusCounts(),
  });

  // Fetch Student Directory from PostgreSQL
  const {
    data: directoryResponse,
    isLoading: isDirectoryLoading,
    isError: isDirectoryError,
  } = useQuery({
    queryKey: [
      "studentsDirectory",
      activeSearch,
      departmentId,
      programId,
      batchId,
      sectionId,
      status,
      page,
    ],
    queryFn: () =>
      studentsService.getStudents({
        search: activeSearch,
        departmentId: departmentId ? Number(departmentId) : undefined,
        programId: programId ? Number(programId) : undefined,
        batchId: batchId ? Number(batchId) : undefined,
        sectionId: sectionId ? Number(sectionId) : undefined,
        status: status || undefined,
        page,
        limit: 15,
      }),
  });

  // Fetch Single Student Profile when selected
  const {
    data: studentProfile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useQuery({
    queryKey: ["studentDetailProfile", selectedStudentId],
    queryFn: () => (selectedStudentId ? studentsService.getStudentById(selectedStudentId) : null),
    enabled: !!selectedStudentId,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setActiveSearch("");
    setDepartmentId("");
    setProgramId("");
    setBatchId("");
    setSectionId("");
    setStatus("");
    setPage(1);
  };

  const handleSelectStudent = (student: StudentListItem) => {
    setSelectedStudentId(student.hallTicketNumber || student.id);
    setActiveTab("personal");
  };

  // Table columns for student directory roster
  const studentColumns: Column<StudentListItem>[] = [
    {
      header: "Hall Ticket",
      accessor: (row) => (
        <span className="font-mono font-bold text-primary-600 dark:text-primary-400">
          {row.hallTicketNumber}
        </span>
      ),
      sortable: true,
    },
    {
      header: "Student Name",
      accessor: "name",
      sortable: true,
    },
    {
      header: "Department",
      accessor: (row) => row.departmentCode || row.departmentName || "N/A",
    },
    {
      header: "Program",
      accessor: (row) => row.programCode || row.programName || "N/A",
    },
    {
      header: "Batch",
      accessor: (row) => row.batchName || "N/A",
    },
    {
      header: "Section",
      accessor: (row) => (row.sectionName ? `Sec ${row.sectionName}` : "N/A"),
    },
    {
      header: "Status",
      accessor: (row) => {
        const s = row.enrollmentStatus || "ACTIVE";
        const variant = s === "ACTIVE" ? "success" : s === "GRADUATED" ? "primary" : "warning";
        return <Badge variant={variant as any}>{s}</Badge>;
      },
    },
    {
      header: "Action",
      accessor: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleSelectStudent(row)}
          className="text-xs py-1 px-2.5"
        >
          View Profile <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      ),
    },
  ];

  const studentsList = directoryResponse?.students || [];
  const pagination = directoryResponse?.pagination || { page: 1, limit: 15, total: 0, totalPages: 0 };

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner with Database Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" /> Student Directory & Search
          </h2>
          <p className="text-xs text-slate-400">
            Real PostgreSQL student directory with academic filtering, batch tracking, and profile inspect.
          </p>
        </div>
        {statusCounts && (
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800/40 rounded-xl text-xs font-semibold text-primary-700 dark:text-primary-300">
              Total Students: <span className="font-bold">{statusCounts.students}</span>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Active Enrollments: <span className="font-bold">{statusCounts.enrollments}</span>
            </div>
          </div>
        )}
      </div>

      {/* Detail Profile Modal / Full View */}
      {selectedStudentId && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedStudentId(null)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Student Directory
            </Button>
            <span className="text-xs text-slate-400">
              Viewing PostgreSQL Profile for <strong className="text-slate-700 dark:text-slate-300">{selectedStudentId}</strong>
            </span>
          </div>

          {isProfileLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading student profile from database...</div>
          ) : isProfileError || !studentProfile ? (
            <div className="py-8 text-center text-xs text-rose-500">
              Unable to load profile for student {selectedStudentId}.
            </div>
          ) : (
            <div className="space-y-6">
              <StudentProfileCard
                student={{
                  id: studentProfile.id,
                  hallTicketNumber: studentProfile.hallTicketNumber,
                  name: studentProfile.name,
                  email: studentProfile.email || "",
                  mobile: studentProfile.phoneNumber || "",
                  dateOfBirth: studentProfile.dateOfBirth || "",
                  gender: (studentProfile.gender as any) || "Other",
                  department: studentProfile.departmentName || studentProfile.departmentCode || "",
                  section: studentProfile.sectionName || "",
                  year: (studentProfile as any).year || 1,
                  admissionYear: studentProfile.batchStartYear || 2024,
                  isActive: studentProfile.enrollmentStatus !== "INACTIVE",
                } as any}
              />

              {/* Detail Tabs */}
              <Tabs
                tabs={[
                  { id: "personal", label: "Personal Information", icon: <GraduationCap className="w-4 h-4" /> },
                  { id: "academic", label: "Academic Enrollment", icon: <Building2 className="w-4 h-4" /> },
                  { id: "examinations", label: "Examination Records", icon: <BookOpen className="w-4 h-4" /> },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
              />

              {activeTab === "personal" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5 bg-slate-50 dark:bg-slate-850/50 rounded-2xl text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Full Name</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{studentProfile.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Hall Ticket Number</span>
                    <span className="font-mono font-bold text-primary-600">{studentProfile.hallTicketNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Gender</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{studentProfile.gender || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Date of Birth</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{studentProfile.dateOfBirth || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Email Address</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{studentProfile.email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Phone Number</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{studentProfile.phoneNumber || "N/A"}</span>
                  </div>
                </div>
              )}

              {activeTab === "academic" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5 bg-slate-50 dark:bg-slate-850/50 rounded-2xl text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Department</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {studentProfile.departmentName} ({studentProfile.departmentCode})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Program</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {studentProfile.programName} ({studentProfile.programCode})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Academic Batch</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{studentProfile.batchName || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Section</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{studentProfile.sectionName || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Enrollment Status</span>
                    <Badge variant={studentProfile.enrollmentStatus === "ACTIVE" ? "success" : "warning"}>
                      {studentProfile.enrollmentStatus || "ACTIVE"}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Joined Date</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{studentProfile.joinedDate || "N/A"}</span>
                  </div>
                </div>
              )}

              {activeTab === "examinations" && (
                <div className="py-8 px-4 text-center bg-slate-50 dark:bg-slate-850/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-2">
                  <BookOpen className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">No academic results have been imported yet.</p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    When examination results are uploaded via the Excel Import module for this student, their normalized marks, grades, and SGPA/CGPA will appear here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Academic Filter Controls */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" /> Filter Students
          </span>
          {(activeSearch || departmentId || programId || batchId || sectionId || status) && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-grow">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Hall Ticket Number or Student Name..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary-500 text-slate-800 dark:text-slate-200"
            />
          </div>
          <Button type="submit" variant="primary" size="sm" className="px-5">
            Search
          </Button>
        </form>

        {/* Dynamic PostgreSQL Academic Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Department</label>
            <Select
              options={[
                { label: "All Departments", value: "" },
                ...departments.map((d) => ({
                  label: `${d.departmentCode} - ${d.departmentName}`,
                  value: d.id,
                })),
              ]}
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setProgramId("");
                setBatchId("");
                setSectionId("");
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Program</label>
            <Select
              options={[
                { label: "All Programs", value: "" },
                ...programs.map((p) => ({
                  label: `${p.programCode} - ${p.programName}`,
                  value: p.id,
                })),
              ]}
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setBatchId("");
                setSectionId("");
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Academic Batch</label>
            <Select
              options={[
                { label: "All Batches", value: "" },
                ...batches.map((b) => ({
                  label: b.batchName,
                  value: b.id,
                })),
              ]}
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                setSectionId("");
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Section</label>
            <Select
              options={[
                { label: "All Sections", value: "" },
                ...sections.map((s) => ({
                  label: `Section ${s.sectionName}`,
                  value: s.id,
                })),
              ]}
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Status</label>
            <Select
              options={[
                { label: "All Statuses", value: "" },
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" },
                { label: "Graduated", value: "GRADUATED" },
                { label: "Suspended", value: "SUSPENDED" },
              ]}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Directory Table View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Enrolled Students Roster ({pagination.total})
          </h3>
          <span className="text-xs text-slate-400">
            Page {pagination.page} of {pagination.totalPages || 1}
          </span>
        </div>

        {isDirectoryLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading students from PostgreSQL database...</div>
        ) : isDirectoryError ? (
          <div className="py-12 text-center text-xs text-rose-500">
            Unable to connect to the student database. Please check your backend connection.
          </div>
        ) : studentsList.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-3">
            <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">No students found in database.</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              No matching records found. Upload a Student Master Excel spreadsheet in the Upload center to register students into PostgreSQL.
            </p>
          </div>
        ) : (
          <>
            <Table
              columns={studentColumns}
              data={studentsList}
              isLoading={false}
              emptyMessage="No students found."
            />

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="text-xs"
                >
                  Previous
                </Button>
                <span className="text-xs text-slate-500 font-semibold">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} students
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
