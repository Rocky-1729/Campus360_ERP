import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const DashboardLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Helper to map pathname to friendly header title
  const getHeaderTitle = (): string => {
    const path = location.pathname;
    if (path.includes('/admin/dashboard')) return 'System Admin Dashboard';
    if (path.includes('/admin/faculty')) return 'Faculty Directory & CRUD';
    if (path.includes('/admin/students/upload')) return 'Student Master Spreadsheet Import';
    if (path.includes('/admin/marks/upload')) return 'Semester Result spreadsheet Import';
    if (path.includes('/admin/subjects')) return 'Course Subject Directory';
    if (path.includes('/admin/assignments')) return 'Faculty Assignments Mapping';
    if (path.includes('/admin/analytics')) return 'Department Academic Analytics';
    if (path.includes('/admin/notifications')) return 'Broadcast Department Circulars';
    if (path.includes('/admin/students/search')) return 'Student Profile Lookup';

    if (path.includes('/faculty/dashboard')) return 'Faculty Portal Dashboard';
    if (path.includes('/faculty/students')) return 'Assigned Students Roster';
    if (path.includes('/faculty/attendance')) return 'Daily Section Attendance Marking';
    if (path.includes('/faculty/certificates')) return 'Student Certificates Verification';
    if (path.includes('/faculty/achievements')) return 'Student Achievements Review';
    if (path.includes('/faculty/analytics')) return 'Classroom Analytics Dashboard';
    if (path.includes('/faculty/notifications')) return 'Compose Class Announcements';

    if (path.includes('/student/dashboard')) return 'Student Dashboard Welcome';
    if (path.includes('/student/marks')) return 'Official Academic Records';
    if (path.includes('/student/attendance')) return 'My Subject-wise Attendance';
    if (path.includes('/student/certificates')) return 'Upload Co-curricular Certificates';
    if (path.includes('/student/achievements')) return 'Upload Extra-curricular Achievements';
    if (path.includes('/student/notifications')) return 'Circulars & Announcements';

    return 'Campus360 Academic Management System';
  };

  return (
    <div className="flex w-full min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Sidebar navigation */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main app panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} title={getHeaderTitle()} />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
