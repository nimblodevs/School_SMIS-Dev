import { Navigate, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from './api/client.js'
import {
  ChangePasswordPage,
  ForgotPasswordPage,
  LoginOtpPage,
  LoginPage,
  ResetPasswordCodePage,
  ResetPasswordPage,
  WorkspacePage,
} from './features/Auth/AuthPages.jsx'

function ProtectedRoute() {
  const { data, isPending, isError } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.getMe })

  if (isPending) return <div className="grid min-h-screen place-items-center bg-[#f6f7f2] text-sm text-[#66756b]">Checking your session...</div>
  if (isError) return <Navigate to="/login" replace />
  if (data?.data?.mustChangePassword || data?.data?.requiresPasswordReset) return <Navigate to="/change-password" replace />
  return <WorkspacePage />
}

const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/verify-login" element={<LoginOtpPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordCodePage />} />
    <Route path="/reset-password/new" element={<ResetPasswordPage />} />
    <Route path="/change-password" element={<ChangePasswordPage />} />
    <Route path="/workspace" element={<ProtectedRoute />} />
    <Route path="*" element={<Navigate to="/workspace" replace />} />
  </Routes>
)

export default App