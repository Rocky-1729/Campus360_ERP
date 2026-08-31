import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

// Layouts
import { AuthLayout } from "./components/layout/AuthLayout";
import { DashboardLayout } from "./components/layout/DashboardLayout";

// Guard components
import { ProtectedRoute } from "./components/shared/ProtectedRoute";
import { RoleRoute } from "./components/shared/RoleRoute";

// Pages - Auth
import { LoginPage } from "./pages/auth/LoginPage";

// Pages - Admin
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { FacultyManagement } from "./pages/admin/FacultyManagement";
import { StudentUpload } from "./pages/admin/StudentUpload";
import { MarksUpload } from "./pages/admin/MarksUpload";
import { SubjectManagement } from "./pages/admin/SubjectManagement";
import { AssignmentManagement } from "./pages/admin/AssignmentManagement";
import { AdminAnalytics } from "./pages/admin/AdminAnalytics";
import { AdminNotifications } from "./pages/admin/AdminNotifications";
import { StudentSearch as AdminStudentSearch } from "./pages/admin/StudentSearch";
import { SystemBackup } from "./pages/admin/SystemBackup";

// Pages - Faculty
import { FacultyDashboard } from "./pages/faculty/FacultyDashboard";
import { StudentSearch as FacultyStudentSearch } from "./pages/faculty/StudentSearch";
import { StudentProfile as FacultyStudentProfile } from "./pages/faculty/StudentProfile";
import { AttendanceMarking } from "./pages/faculty/AttendanceMarking";
import { CertificateReview } from "./pages/faculty/CertificateReview";
import { AchievementReview } from "./pages/faculty/AchievementReview";
import { FacultyAnalytics } from "./pages/faculty/FacultyAnalytics";
import { FacultyNotifications } from "./pages/faculty/FacultyNotifications";

// Pages - Student
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { AcademicRecords } from "./pages/student/AcademicRecords";
import { AttendanceView } from "./pages/student/AttendanceView";
import { CertificateUpload } from "./pages/student/CertificateUpload";
import { AchievementUpload } from "./pages/student/AchievementUpload";
import { StudentNotifications } from "./pages/student/StudentNotifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Default Route redirecting to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected Routes (Require Login) */}
          <Route element={<ProtectedRoute />}>
            {/* Admin Routes */}
            <Route element={<RoleRoute allowedRoles={["admin"]} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/faculty" element={<FacultyManagement />} />
                <Route
                  path="/admin/students/upload"
                  element={<StudentUpload />}
                />
                <Route path="/admin/marks/upload" element={<MarksUpload />} />
                <Route path="/admin/subjects" element={<SubjectManagement />} />
                <Route
                  path="/admin/assignments"
                  element={<AssignmentManagement />}
                />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route
                  path="/admin/notifications"
                  element={<AdminNotifications />}
                />
                <Route
                  path="/admin/students/search"
                  element={<AdminStudentSearch />}
                />
                <Route path="/admin/system" element={<SystemBackup />} />
              </Route>
            </Route>

            {/* Faculty Routes */}
            <Route element={<RoleRoute allowedRoles={["faculty", "admin"]} />}>
              <Route element={<DashboardLayout />}>
                <Route
                  path="/faculty/dashboard"
                  element={<FacultyDashboard />}
                />
                <Route
                  path="/faculty/students"
                  element={<FacultyStudentSearch />}
                />
                <Route
                  path="/faculty/students/:hallTicket"
                  element={<FacultyStudentProfile />}
                />
                <Route
                  path="/faculty/attendance"
                  element={<AttendanceMarking />}
                />
                <Route
                  path="/faculty/certificates"
                  element={<CertificateReview />}
                />
                <Route
                  path="/faculty/achievements"
                  element={<AchievementReview />}
                />
                <Route
                  path="/faculty/analytics"
                  element={<FacultyAnalytics />}
                />
                <Route
                  path="/faculty/notifications"
                  element={<FacultyNotifications />}
                />
              </Route>
            </Route>

            {/* Student Routes */}
            <Route element={<RoleRoute allowedRoles={["student"]} />}>
              <Route element={<DashboardLayout />}>
                <Route
                  path="/student/dashboard"
                  element={<StudentDashboard />}
                />
                <Route path="/student/marks" element={<AcademicRecords />} />
                <Route
                  path="/student/attendance"
                  element={<AttendanceView />}
                />
                <Route
                  path="/student/certificates"
                  element={<CertificateUpload />}
                />
                <Route
                  path="/student/achievements"
                  element={<AchievementUpload />}
                />
                <Route
                  path="/student/notifications"
                  element={<StudentNotifications />}
                />
              </Route>
            </Route>
          </Route>

          {/* Fallback Catch-all Route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          className:
            "dark:bg-slate-900 dark:text-slate-100 dark:border dark:border-slate-800 text-xs font-semibold rounded-xl",
          duration: 3000,
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
