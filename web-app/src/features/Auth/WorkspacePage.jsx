import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  BookOpenCheck,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  ScrollText,
  UserCog,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { authApi, getSelectedSchoolId, schoolApi, setSelectedSchoolId } from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'
import { FormMessage } from '../../components/ui/FormMessage.jsx'

const EMPTY_SCHOOLS = []
const navGroups = [
  {
    label: 'Learning',
    items: [
      { to: '/workspace/students', label: 'Students', icon: GraduationCap },
      { to: '/workspace/parents', label: 'Families', icon: Users },
      { to: '/workspace/academics', label: 'Academics', icon: Building2 },
      { to: '/workspace/attendance', label: 'Attendance', icon: ClipboardCheck },
      { to: '/workspace/exams', label: 'Exams & results', icon: BookOpenCheck },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/workspace/fees', label: 'Fees & payments', icon: Banknote },
      { to: '/workspace/payroll', label: 'Payroll', icon: Banknote },
      { to: '/workspace/staff', label: 'Staff & leave', icon: UserCog },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/workspace/reports', label: 'Report cards', icon: FileText },
    ],
  },
]

export function WorkspacePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user } = useOutletContext()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const canManagePlatform = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role)
  const isEditingRecord = location.pathname.endsWith('/edit')
  const currentPage = location.pathname === '/workspace'
    ? 'Overview'
    : location.pathname === '/workspace/schools'
      ? 'School directory'
      : location.pathname.startsWith('/workspace/schools/')
        ? isEditingRecord ? 'Edit school' : 'School profile'
        : location.pathname.startsWith('/workspace/students/')
          ? isEditingRecord ? 'Edit student' : 'Student profile'
          : location.pathname.startsWith('/workspace/parents/')
            ? isEditingRecord ? 'Edit parent' : 'Parent profile'
            : navGroups.flatMap((group) => group.items).find((item) => item.to === location.pathname)?.label || 'Workspace'
  const [storedSchoolId, setStoredSchoolId] = useState(getSelectedSchoolId)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const schoolsQuery = useQuery({
    queryKey: ['platform', 'schools'],
    queryFn: () => schoolApi.list({ pageSize: 100 }),
    enabled: isSuperAdmin,
  })
  const availableSchools = schoolsQuery.data?.data?.schools
    ? schoolsQuery.data.data.schools.filter((school) => school.isActive)
    : EMPTY_SCHOOLS
  const storedSelectionIsAvailable = availableSchools.some((school) => school.id === storedSchoolId)
  const selectedSchoolId = isSuperAdmin
    ? storedSelectionIsAvailable ? storedSchoolId : ''
    : user?.schoolId || ''
  const selectedSchool = isSuperAdmin
    ? availableSchools.find((school) => school.id === selectedSchoolId)
    : user?.school
  const logout = useMutation({ mutationFn: authApi.logout, onSettled: () => { queryClient.clear(); setSelectedSchoolId(''); navigate('/login', { replace: true }) } })
  function changeSchool(schoolId) {
    setStoredSchoolId(schoolId)
    setSelectedSchoolId(schoolId)
    queryClient.removeQueries({ queryKey: ['tenant'] })
  }

  function renderNavLink({ to, label, icon: Icon, end = false }) {
    return <NavLink
      key={to}
      to={to}
      end={end}
      onClick={() => setMobileMenuOpen(false)}
      className={({ isActive }) => `group flex items-center gap-3 border-l-2 py-2.5 pl-2.5 pr-3 text-sm font-semibold transition-colors ${isActive ? 'border-[#d3e77a] bg-white/[0.09] text-white' : 'border-transparent text-[#bdcdc2] hover:bg-white/[0.06] hover:text-white'}`}
    >
      <Icon aria-hidden="true" className="h-[17px] w-[17px] shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-[#d3e77a] opacity-0 group-[.active]:opacity-100" />
    </NavLink>
  }

  const mainNav = <>
    <NavLink
      to="/workspace"
      end
      onClick={() => setMobileMenuOpen(false)}
      className={({ isActive }) => `mb-5 flex items-center gap-3 border-l-2 py-2.5 pl-2.5 pr-3 text-sm font-semibold transition-colors ${isActive ? 'border-[#d3e77a] bg-white/[0.09] text-white' : 'border-transparent text-[#bdcdc2] hover:bg-white/[0.06] hover:text-white'}`}
    >
      <LayoutDashboard aria-hidden="true" className="h-[17px] w-[17px]" />Overview
    </NavLink>
    {isSuperAdmin && <div className="mb-6">
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#96aa9b]">Platform</p>
      {renderNavLink({ to: '/workspace/schools', label: 'School directory', icon: Building2 })}
    </div>}
    {navGroups.map((group) => <div className="mb-6" key={group.label}>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#96aa9b]">{group.label}</p>
      <div className="space-y-1">{group.items.map(renderNavLink)}</div>
    </div>)}
    {canManagePlatform && <div className="mb-6">
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#96aa9b]">Administration</p>
      <div className="space-y-1">
        {renderNavLink({ to: '/workspace/users', label: 'User directory', icon: UsersRound })}
        {renderNavLink({ to: '/workspace/audit', label: 'Audit logs', icon: ScrollText })}
      </div>
    </div>}
  </>

  if (isSuperAdmin && schoolsQuery.isPending) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f7f2] text-sm text-[#66756b]">Loading your workspace...</div>
  }

  return <div className="min-h-screen bg-[#f3f5f1] text-[#17211b] lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
    <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto bg-[#17372f] px-4 py-5 text-white lg:flex">
      <NavLink to="/workspace" className="mb-8 flex items-center gap-3 rounded-md px-2 py-2" aria-label="School SMIS home">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#d3e77a] text-[#183d35]"><GraduationCap className="h-5 w-5" aria-hidden="true" /></span>
        <span><span className="block text-[10px] font-bold tracking-[0.14em] text-[#aebfb1]">SCHOOL</span><span className="font-serif text-xl leading-tight">SMIS</span></span>
      </NavLink>
      <nav aria-label="Main navigation">{mainNav}</nav>
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d3e77a] text-sm font-bold text-[#183d35]">{(user?.firstName || user?.username || 'A').slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.firstName || user?.username || 'Account'}</p><p className="truncate text-xs text-[#aebfb1]">{user?.role?.replaceAll('_', ' ')}</p></div>
        </div>
      </div>
    </aside>

    <div className="min-w-0">
      <header className="sticky top-0 z-30 border-b border-[#dce2d8] bg-white shadow-[0_1px_3px_rgba(24,61,53,0.04)]">
        <div className="flex min-h-[76px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#dce2d8] text-[#183d35] hover:bg-[#f3f5f1] lg:hidden">{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#718077]">Workspace <span className="px-1 text-[#bdc8be]">/</span> {currentPage}</p>
              <p className="truncate text-sm font-semibold text-[#183d35]">{selectedSchool?.name || (isSuperAdmin ? 'Choose a school' : 'School workspace')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {isSuperAdmin && <label className="relative flex max-w-[min(44vw,300px)] items-center gap-2 rounded-md border border-[#dce2d8] bg-white px-3 py-2 focus-within:border-[#183d35] focus-within:ring-4 focus-within:ring-[#d3e77a]/25">
              <School aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6b7c6f]" />
              <span className="sr-only">Selected school</span>
              <select aria-label="Selected school" value={selectedSchoolId} onChange={(event) => changeSchool(event.target.value)} className="w-full min-w-0 appearance-none bg-transparent pr-5 text-sm font-semibold text-[#304139] outline-none">
                {!availableSchools.length && <option value="">No active schools</option>}
                {!selectedSchoolId && availableSchools.length > 0 && <option value="">Choose school</option>}
                {availableSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 h-4 w-4 text-[#7c8a80]" />
            </label>}
            <div className="hidden text-right sm:block"><p className="text-sm font-bold text-[#183d35]">{user?.firstName || user?.username || 'Account'}</p><p className="text-xs text-[#7c8a80]">{user?.email}</p></div>
            <Button type="button" variant="secondary" className="px-3 py-2" isPending={logout.isPending} icon={<LogOut aria-hidden="true" className="h-4 w-4" />} onClick={() => logout.mutate()}><span className="hidden sm:inline">Sign out</span></Button>
          </div>
        </div>
        {mobileMenuOpen && <nav aria-label="Mobile navigation" className="absolute left-0 right-0 top-full max-h-[calc(100vh-76px)] overflow-y-auto border-b border-[#dce2d8] bg-[#183d35] px-4 py-4 shadow-xl lg:hidden">{mainNav}</nav>}
      </header>
      <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
        {schoolsQuery.isError && isSuperAdmin && <FormMessage message={schoolsQuery.error.message} />}
        {!selectedSchoolId && isSuperAdmin && <div className="mb-6 flex items-start gap-3 rounded-md border border-[#e8c9b9] bg-[#fff7f2] px-4 py-3 text-sm text-[#744a36]"><School aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span>Select an active school above to open its workspace, or register a school from the directory.</span></div>}
        <Outlet context={{ user, selectedSchoolId, selectedSchool, isSuperAdmin, changeSchool }} />
      </main>
    </div>
  </div>
}