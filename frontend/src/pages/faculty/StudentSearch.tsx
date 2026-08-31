import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { facultyApi } from "../../api/faculty.api";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export const StudentSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Fetch list of assigned students
  const { data: response, isLoading } = useQuery({
    queryKey: ["assignedStudentsList"],
    queryFn: () => facultyApi.getStudents(),
  });

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim().toUpperCase();
    if (!term) {
      toast.error("Please enter a search query");
      return;
    }

    // 1. Try local match first
    const allStudents = Array.isArray(response?.data?.data)
      ? response.data.data
      : [];
    const match = allStudents.find(
      (s: any) => s.hallTicketNumber.toUpperCase() === term,
    );
    if (match) {
      navigate(`/faculty/students/${term}`);
      return;
    }

    // 2. Fallback to direct database search
    try {
      const searchRes = await facultyApi.searchStudent(term);
      if (searchRes?.data) {
        navigate(`/faculty/students/${term}`);
        return;
      }
    } catch (error) {
      // Fall through to error toast
    }

    toast.error(`No student with hall ticket "${term}" found in roster.`);
  };

  const allStudents = Array.isArray(response?.data?.data)
    ? response.data.data
    : [];
  const students = allStudents.filter((s: any) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (s.name || "").toLowerCase().includes(term) ||
      (s.hallTicketNumber || "").toLowerCase().includes(term) ||
      (s.section || "").toLowerCase().includes(term) ||
      (s.year || "").toString().includes(term)
    );
  });

  const columns: Column<any>[] = [
    {
      header: "Hall Ticket",
      accessor: "hallTicketNumber",
      sortable: true,
      sortKey: "hallTicketNumber",
    },
    { header: "Name", accessor: "name", sortable: true, sortKey: "name" },
    { header: "Section", accessor: "section" },
    { header: "Year", accessor: "year" },
    { header: "Email", accessor: "email" },
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
          data={students}
          isLoading={isLoading}
          id="roster-table"
        />
      </div>
    </div>
  );
};
