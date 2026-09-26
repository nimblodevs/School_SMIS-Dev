import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'
import { AuthLayout } from '../../components/layout/AuthLayout.jsx'

export function WorkspacePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.getMe })
  const logout = useMutation({ mutationFn: authApi.logout, onSettled: () => { queryClient.clear(); navigate('/login', { replace: true }) } })
  const user = data?.data

  if (isPending) return <div className="grid min-h-screen place-items-center bg-[#f6f7f2] text-sm text-[#66756b]">Loading your workspace...</div>
  if (isError) return <AuthLayout title="Your session has ended."><p className="text-sm text-[#66756b]">Sign in again to access the school workspace.</p><Link className="mt-6 inline-block font-bold text-[#b34d3d]" to="/login">Return to sign in</Link></AuthLayout>

  return <main className="min-h-screen bg-[#f6f7f2] text-[#17211b]">
    <header className="border-b border-[#dce2d8] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div><p className="text-xs font-bold tracking-[0.2em] text-[#b34d3d] uppercase">School SMIS</p><h1 className="mt-1 font-serif text-2xl text-[#183d35]">Good to see you, {user?.firstName || user?.username || 'there'}.</h1></div>
        <Button type="button" variant="secondary" isPending={logout.isPending} icon={<LogOut aria-hidden="true" className="h-4 w-4" />} onClick={() => logout.mutate()}>Sign out</Button>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <div className="rounded-3xl bg-[#183d35] p-7 text-white sm:p-10">
        <p className="text-xs font-bold tracking-[0.2em] text-[#d3e77a] uppercase">{user?.role || 'Authenticated user'}</p>
        <h2 className="mt-3 max-w-xl font-serif text-4xl leading-tight">Your workspace is ready for the day.</h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-[#c5d1c2]">Your role-based modules will appear here as they are connected to the school operations dashboard.</p>
      </div>
    </section>
  </main>
}