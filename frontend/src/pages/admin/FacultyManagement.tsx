import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Edit2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { adminApi } from "../../api/admin.api";
import { Table } from "../../components/ui/Table";
import type { Column } from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

const facultySchema = z.object({
  facultyId: z.string().min(1, "Faculty ID is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phone: z.string().optional(),
  designation: z.string().optional(),
  qualification: z.string().optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .or(z.literal("")),
});

type FacultyFormValues = z.infer<typeof facultySchema>;

export const FacultyManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [toggleConfirmId, setToggleConfirmId] = useState<string | null>(null);

  // Fetch faculty list
  const { data: response, isLoading } = useQuery({
    queryKey: ["facultyList"],
    queryFn: () => adminApi.getAllFaculty(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FacultyFormValues>({
    resolver: zodResolver(facultySchema),
  });

  // Mutators
  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.createFaculty(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facultyList"] });
      toast.success("Faculty created successfully");
      setModalOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create faculty");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminApi.updateFaculty(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facultyList"] });
      toast.success("Faculty updated successfully");
      setModalOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update faculty");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleFaculty(id),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["facultyList"] });
      toast.success(res.message || "Status updated successfully");
      setToggleConfirmId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to toggle status");
      setToggleConfirmId(null);
    },
  });

  const handleAdd = () => {
    setEditingFaculty(null);
    reset({
      facultyId: "",
      name: "",
      email: "",
      phone: "",
      designation: "",
      qualification: "",
      password: "",
    });
    setModalOpen(true);
  };

  const handleEdit = (faculty: any) => {
    setEditingFaculty(faculty);
    reset({
      facultyId: faculty.facultyId,
      name: faculty.name,
      email: faculty.email,
      phone: faculty.phone,
      designation: faculty.designation,
      qualification: faculty.qualification,
      password: "", // do not display password
    });
    setModalOpen(true);
  };

  const onSubmit = (values: FacultyFormValues) => {
    if (editingFaculty) {
      const { password, ...updateData } = values;
      // Only send password if modified
      const submitData = password ? values : updateData;
      updateMutation.mutate({ id: editingFaculty.id, data: submitData });
    } else {
      createMutation.mutate(values);
    }
  };

  const facultyData = response?.data || [];

  const columns: Column<any>[] = [
    {
      header: "Faculty ID",
      accessor: (row) => row.faculty.facultyId,
      sortable: true,
      sortKey: "facultyId",
    },
    {
      header: "Name",
      accessor: (row) => row.faculty.name,
      sortable: true,
      sortKey: "name",
    },
    { header: "Email", accessor: (row) => row.faculty.email },
    { header: "Designation", accessor: (row) => row.faculty.designation },
    {
      header: "Status",
      accessor: (row) => {
        const isActive = row.faculty.isActive;
        return (
          <Badge variant={isActive ? "success" : "danger"}>
            {isActive ? "Active" : "Disabled"}
          </Badge>
        );
      },
    },
    {
      header: "Assignments",
      accessor: (row) => (
        <span className="font-semibold text-slate-700 dark:text-slate-350">
          {row.assignmentCount} class(es)
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(row.faculty)}
            id={`edit-faculty-btn-${row.faculty.facultyId}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant={row.faculty.isActive ? "danger" : "success"}
            onClick={() => setToggleConfirmId(row.faculty.id)}
            id={`toggle-faculty-btn-${row.faculty.facultyId}`}
          >
            {row.faculty.isActive ? "Disable" : "Enable"}
          </Button>
        </div>
      ),
    },
  ];

  // Map deep data keys to simplify row access for Table
  const tableData = facultyData.map((row: any) => ({
    ...row,
    facultyId: row.faculty.facultyId,
    name: row.faculty.name,
  }));

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Faculty Management
          </h2>
          <p className="text-xs text-slate-400">
            View and update directory records of CSE Faculty.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleAdd}
          id="add-faculty-trigger-btn"
        >
          <UserPlus className="w-4 h-4 mr-2" /> Add Faculty
        </Button>
      </div>

      <Table
        columns={columns}
        data={tableData}
        isLoading={isLoading}
        id="faculty-table"
      />

      {/* Add / Edit Faculty Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFaculty ? "Edit Faculty Member" : "Register New Faculty"}
        size="md"
        id="faculty-form-modal"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              {...register("facultyId")}
              label="Faculty ID *"
              placeholder="e.g. CSE-102"
              error={errors.facultyId?.message}
              disabled={!!editingFaculty}
              id="faculty-id-field"
            />
            <Input
              {...register("name")}
              label="Full Name *"
              placeholder="e.g. Dr. Ramesh Prasad"
              error={errors.name?.message}
              id="faculty-name-field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              {...register("email")}
              label="Email Address *"
              placeholder="ramesh@campus360.edu"
              error={errors.email?.message}
              id="faculty-email-field"
            />
            <Input
              {...register("phone")}
              label="Phone Number"
              placeholder="+91 XXXXX XXXXX"
              error={errors.phone?.message}
              id="faculty-phone-field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              {...register("designation")}
              label="Designation"
              placeholder="e.g. Professor / HOD"
              error={errors.designation?.message}
              id="faculty-designation-field"
            />
            <Input
              {...register("qualification")}
              label="Qualification"
              placeholder="e.g. Ph.D (Computer Science)"
              error={errors.qualification?.message}
              id="faculty-qualification-field"
            />
          </div>

          <Input
            {...register("password")}
            label={
              editingFaculty
                ? "Reset Password (Leave blank to keep current)"
                : "Account Password *"
            }
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            id="faculty-password-field"
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              id="faculty-form-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending || updateMutation.isPending}
              id="faculty-form-submit"
            >
              {editingFaculty ? "Save Changes" : "Register Faculty"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Soft delete toggle account confirm dialog */}
      <ConfirmDialog
        isOpen={!!toggleConfirmId}
        onClose={() => setToggleConfirmId(null)}
        onConfirm={() =>
          toggleConfirmId && toggleMutation.mutate(toggleConfirmId)
        }
        title="Toggle Account Access"
        message="Are you sure you want to toggle this faculty's account active status? Disabled faculty members will not be able to sign in."
        id="toggle-faculty-confirm"
      />
    </div>
  );
};
