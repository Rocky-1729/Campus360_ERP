import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Upload,
  BookOpen,
  FileSpreadsheet,
  BarChart3,
  Bell,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BookMarked,
  UserSquare2,
  GraduationCap,
  Database,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen,
  setMobileOpen,
}) => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const role = user.role;

  // Define navigation links based on user role
  const getNavLinks = () => {
    switch (role) {
      case "admin":
        return [
          {
            to: "/admin/dashboard",
            label: "Dashboard",
            icon: <LayoutDashboard className="w-5 h-5" />,
          },
          {
            to: "/admin/faculty",
            label: "Faculty Management",
            icon: <Users className="w-5 h-5" />,
          },
          {
            to: "/admin/students/upload",
            label: "Upload Students",
            icon: <Upload className="w-5 h-5" />,
          },
          {
            to: "/admin/marks/upload",
            label: "Upload Marks",
            icon: <FileSpreadsheet className="w-5 h-5" />,
          },
          {
            to: "/admin/subjects",
            label: "Subject Management",
            icon: <BookOpen className="w-5 h-5" />,
          },
          {
            to: "/admin/assignments",
            label: "Faculty Assignment",
            icon: <BookMarked className="w-5 h-5" />,
          },
          {
            to: "/admin/analytics",
            label: "Analytics",
            icon: <BarChart3 className="w-5 h-5" />,
          },
          {
            to: "/admin/notifications",
            label: "Notifications",
            icon: <Bell className="w-5 h-5" />,
          },
          {
            to: "/admin/students/search",
            label: "Search Students",
            icon: <Search className="w-5 h-5" />,
          },
          {
            to: "/admin/system",
            label: "System Backup",
            icon: <Database className="w-5 h-5" />,
          },
        ];
      case "faculty":
        return [
          {
            to: "/faculty/dashboard",
            label: "Dashboard",
            icon: <LayoutDashboard className="w-5 h-5" />,
          },
          {
            to: "/faculty/students",
            label: "My Students",
            icon: <Users className="w-5 h-5" />,
          },
          {
            to: "/faculty/attendance",
            label: "Mark Attendance",
            icon: <FileSpreadsheet className="w-5 h-5" />,
          },
          {
            to: "/faculty/certificates",
            label: "Certificates Review",
            icon: <Upload className="w-5 h-5" />,
          },
          {
            to: "/faculty/achievements",
            label: "Achievements Review",
            icon: <BookMarked className="w-5 h-5" />,
          },
          {
            to: "/faculty/analytics",
            label: "Class Analytics",
            icon: <BarChart3 className="w-5 h-5" />,
          },
          {
            to: "/faculty/notifications",
            label: "Notifications",
            icon: <Bell className="w-5 h-5" />,
          },
        ];
      case "student":
        return [
          {
            to: "/student/dashboard",
            label: "Dashboard",
            icon: <LayoutDashboard className="w-5 h-5" />,
          },
          {
            to: "/student/marks",
            label: "Academic Records",
            icon: <BookOpen className="w-5 h-5" />,
          },
          {
            to: "/student/attendance",
            label: "My Attendance",
            icon: <FileSpreadsheet className="w-5 h-5" />,
          },
          {
            to: "/student/certificates",
            label: "Upload Certificates",
            icon: <Upload className="w-5 h-5" />,
          },
          {
            to: "/student/achievements",
            label: "Upload Achievements",
            icon: <BookMarked className="w-5 h-5" />,
          },
          {
            to: "/student/notifications",
            label: "Notifications",
            icon: <Bell className="w-5 h-5" />,
          },
        ];
      default:
        return [];
    }
  };

  const links = getNavLinks();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-400 border-r border-slate-800/80">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-600 text-white rounded-xl shadow-md shadow-primary-900/20 flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          {!collapsed && (
            <span className="font-bold text-white text-base tracking-tight uppercase">
              Campus360 <span className="text-primary-400">ERP</span>
            </span>
          )}
        </div>
        {/* Toggle Collapse Btn (Desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1 hover:bg-slate-800 hover:text-white rounded-lg transition-colors cursor-pointer"
          id="btn-sidebar-collapse"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((link, idx) => (
          <NavLink
            key={idx}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-primary-600 text-white shadow-lg shadow-primary-900/20"
                  : "hover:bg-slate-800/50 hover:text-slate-100"
              }`
            }
            onClick={() => setMobileOpen(false)}
            id={`nav-link-${link.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            {link.icon}
            {!collapsed && <span className="truncate">{link.label}</span>}
          </NavLink>
        ))}
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-800/50">
        <div className="flex items-center gap-3 px-2 py-3 mb-2 rounded-xl bg-slate-850/50">
          <div className="p-2 bg-slate-800 text-slate-300 rounded-lg flex items-center justify-center">
            <UserSquare2 className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="text-left overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 line-clamp-1">
                {user.email.split("@")[0]}
              </p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                {role}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3.5 py-3 text-sm font-medium text-slate-400 hover:text-danger-400 hover:bg-danger-950/20 rounded-xl transition-all cursor-pointer"
          id="sidebar-logout-btn"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block h-screen sticky top-0 transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-in Drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      >
        <aside
          className={`fixed top-0 bottom-0 left-0 w-64 bg-slate-900 transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {sidebarContent}
        </aside>
      </div>
    </>
  );
};
