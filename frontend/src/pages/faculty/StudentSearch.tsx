import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { studentsService } from "../../services/students.service";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export const StudentSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Fetch list of students from real PostgreSQL backend
  const { data: response, isLoading } = useQuery({
    queryKey: ["assignedStudentsList", searchTerm],
    queryFn: () => studentsService.getStudents({ search: searchTerm.trim() || undefined, limit: 50 }),
  });

  const allStudents = response?.students || [];

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim().toUpperCase();
    if (!term) {
      toast.error("Please enter a search query");
      return;
    }

    const match = allStudents.find(
      (s: any) => (s.hallTicketNumber || '').toUpperCase() === term,
    );
    if (match) {
      navigate(`/faculty/students/${term}`);
      return;
    }

    try {
      const directStudent = await studentsService.getStudentById(term);
      if (directStudent?.hallTicketNumber) {
        navigate(`/faculty/students/${term}`);
        return;
      }
    } catch {
      // Fall through to error toast
    }

    toast.error(`No student with hall ticket "${term}" found in roster.`);
  };

  const columns: Column<any>[] = [
    {
      header: "Hall Ticket",
      accessor: "hallTicketNumber",
      sortable: true,
      sortKey: "hallTicketNumber",
    },
    { header: "Name", accessor: "name", sortable: true, sortKey: "name" },
    { header: "Section", accessor: (row) => row.sectionName ? `Sec ${row.sectionName}` : "N/A" },
    { header: "Batch", accessor: (row) => row.batchName || "N/A" },
    { header: "Email", accessor: (row) => row.email || "N/A" },
    {
      header: "Actions",
      accessor: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/faculty/students/${row.hallTicketNumber}`)}
          id={`view-student-${row.hallTicketNumber}`}
        >
          View Profile <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          Assigned Student Roster
        </h2>
        <p className="text-xs text-slate-400">
          Search and lookup academic profiles of students registered in your
          sections.
        </p>
      </div>

      {/* Search Input Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm max-w-xl"
      >
        <div className="flex-grow">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, Hall Ticket, or section..."
            id="student-search-bar"
          />
        </div>
        <Button type="submit" variant="primary" id="student-search-submit">
          <Search className="w-4 h-4 mr-2" /> Search
        </Button>
      </form>

      {/* Roster list table */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Registered Students Directory
        </h3>
        <Table
          columns={columns}
          data={allStudents}
          isLoading={isLoading}
          id="roster-table"
        />
      </div>
    </div>
  );
};
