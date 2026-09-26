import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authApi } from './api/client.js'
import { ChangePasswordPage } from './features/Auth/ChangePasswordPage.jsx'
import { ForgotPasswordPage } from './features/Auth/ForgotPasswordPage.jsx'
import { LoginOtpPage } from './features/Auth/LoginOtpPage.jsx'
import { LoginPage } from './features/Auth/LoginPage.jsx'
import { ResetPasswordCodePage } from './features/Auth/ResetPasswordCodePage.jsx'
import { ResetPasswordPage } from './features/Auth/ResetPasswordPage.jsx'

const lazyPage = (loadPage, name) => lazy(() => loadPage().then((module) => ({ default: module[name] })))
const WorkspacePage = lazyPage(() => import('./features/Auth/WorkspacePage.jsx'), 'WorkspacePage')
const AttendancePage = lazyPage(() => import('./features/Workspace/OperationalPages.jsx'), 'AttendancePage')
const ExamsPage = lazyPage(() => import('./features/Workspace/OperationalPages.jsx'), 'ExamsPage')
const FinancePage = lazyPage(() => import('./features/Workspace/OperationalPages.jsx'), 'FinancePage')
const PayrollPage = lazyPage(() => import('./features/Workspace/OperationalPages.jsx'), 'PayrollPage')
const StaffPage = lazyPage(() => import('./features/Workspace/OperationalPages.jsx'), 'StaffPage')
const AcademicsPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'AcademicsPage')
const DashboardPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'DashboardPage')
const ParentsPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'ParentsPage')
const SchoolsPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'SchoolsPage')
const SchoolDetailsPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'SchoolDetailsPage')
const SchoolEditPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'SchoolEditPage')
const StudentsPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'StudentsPage')
const StudentDetailsPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'StudentDetailsPage')
const StudentEditPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'StudentEditPage')
const ParentDetailsPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'ParentDetailsPage')
const ParentEditPage = lazyPage(() => import('./features/Workspace/WorkspacePages.jsx'), 'ParentEditPage')
const AuditLogsPage = lazyPage(() => import('./features/Workspace/ManagementPages.jsx'), 'AuditLogsPage')
const ReportCardsPage = lazyPage(() => import('./features/Workspace/ManagementPages.jsx'), 'ReportCardsPage')
const UserDirectoryPage = lazyPage(() => import('./features/Workspace/ManagementPages.jsx'), 'UserDirectoryPage')

function ProtectedRoute() {
  const { data, isPending, isError } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.getMe })

  if (isPending) return <div className="grid min-h-screen place-items-center bg-[#f6f7f2] text-sm text-[#66756b]">Checking your session...</div>
  if (isError) return <Navigate to="/login" replace />
  if (data?.data?.mustChangePassword || data?.data?.requiresPasswordReset) return <Navigate to="/change-password" replace />
  return <Outlet context={{ user: data.data }} />
}

const App = () => (
  <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f6f7f2] text-sm text-[#66756b]">Loading workspace...</div>}>
    <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/verify-login" element={<LoginOtpPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordCodePage />} />
    <Route path="/reset-password/new" element={<ResetPasswordPage />} />
    <Route path="/change-password" element={<ChangePasswordPage />} />
    <Route path="/workspace" element={<ProtectedRoute />}>
      <Route element={<WorkspacePage />}>
        <Route index element={<DashboardPage />} />
        <Route path="schools" element={<SchoolsPage />} />
        <Route path="schools/:schoolId" element={<SchoolDetailsPage />} />
        <Route path="schools/:schoolId/edit" element={<SchoolEditPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:studentId" element={<StudentDetailsPage />} />
        <Route path="students/:studentId/edit" element={<StudentEditPage />} />
        <Route path="parents" element={<ParentsPage />} />
        <Route path="parents/:parentId" element={<ParentDetailsPage />} />
        <Route path="parents/:parentId/edit" element={<ParentEditPage />} />
        <Route path="academics" element={<AcademicsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="fees" element={<FinancePage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="reports" element={<ReportCardsPage />} />
        <Route path="users" element={<UserDirectoryPage />} />
        <Route path="audit" element={<AuditLogsPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/workspace" replace />} />
    </Routes>
  </Suspense>
)

export default App