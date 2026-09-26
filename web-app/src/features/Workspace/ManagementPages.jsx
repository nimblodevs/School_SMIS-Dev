import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, FileClock, Search } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { academicsApi, auditApi, authApi, jobsApi, reportCardApi } from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'

const inputClass = 'w-full rounded-md border border-[#cbd6ce] bg-white px-3.5 py-3 text-sm text-[#17211b] shadow-sm outline-none transition placeholder:text-[#8b998e] focus:border-[#183d35] focus:ring-4 focus:ring-[#d3e77a]/25'
const muted = 'text-sm leading-6 text-[#63746a]'

function useTenantQuery(key, queryFn, enabled = true) {
  const { selectedSchoolId } = useOutletContext()
  return useQuery({
    queryKey: ['tenant', selectedSchoolId, key],
    queryFn,
    enabled: Boolean(selectedSchoolId) && enabled,
  })
}

function Heading({ eyebrow, title, description, action }) {
  return <div className="mb-8 flex flex-col gap-5 border-b border-[#d7dfd8] pb-7 sm:flex-row sm:items-end sm:justify-between">
    <div><p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b34d3d]">{eyebrow}</p><h1 className="font-serif text-4xl leading-tight text-[#183d35]">{title}</h1>{description && <p className="mt-2.5 max-w-2xl text-sm leading-6 text-[#63746a]">{description}</p>}</div>
    {action}
  </div>
}

function Notice({ children, tone = 'error' }) {
  const style = tone === 'success' ? 'border-[#bfd08e] bg-[#f2f7e4] text-[#3c5830]' : 'border-[#e9b5a9] bg-[#fff4f0] text-[#8f3a2e]'
  return <div role="status" className={`mb-5 rounded-md border px-4 py-3.5 text-sm leading-5 ${style}`}>{children}</div>
}

function Table({ headers, children, empty, isPending, minWidth = 'min-w-[760px]' }) {
  if (isPending) return <p className={`${muted} py-10 text-center`}>Loading records...</p>
  if (!children || children.length === 0) return <p className={`${muted} border-y border-[#d7dfd8] py-12 text-center`}>{empty}</p>
  return <div className="overflow-x-auto rounded-md border border-[#d7dfd8] bg-white"><table className={`w-full ${minWidth} border-collapse text-left text-sm`}><thead><tr className="border-b border-[#d7dfd8] bg-[#f1f5f0]">{headers.map((header) => <th key={header} className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#63746a]">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#edf0eb] [&_tr]:transition-colors [&_tr:hover]:bg-[#f8faf7]">{children}</tbody></table></div>
}

function Cell({ children, className = '' }) {
  return <td className={`px-4 py-3.5 align-top text-[#34463b] ${className}`}>{children}</td>
}

function EmptySelection() {
  return <div className="grid min-h-64 place-items-center rounded-md border border-dashed border-[#bdcbbf] bg-white px-6 text-center"><div><p className="font-serif text-2xl text-[#183d35]">Select a school</p><p className="mt-2 text-sm text-[#63746a]">Choose an active school from the header to open this workspace.</p></div></div>
}

function pageCount(page, totalPages) {
  return <span className="text-xs font-semibold text-[#63746a]">Page {page} of {Math.max(1, totalPages || 1)}</span>
}

export function UserDirectoryPage() {
  const { selectedSchoolId, user } = useOutletContext()
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25
  const users = useTenantQuery(
    `users:${page}:${role}:${search}`,
    () => authApi.listUsers({ page, pageSize, ...(role ? { role } : {}), ...(search ? { search } : {}) }),
    ['ADMIN', 'SUPER_ADMIN'].includes(user?.role),
  )
  const result = users.data?.data
  const rows = result?.users || []

  function submitSearch(event) {
    event.preventDefault()
    setPage(1)
    setSearch(searchText.trim())
  }

  if (!selectedSchoolId) return <EmptySelection />
  return <>
    <Heading eyebrow="Access administration" title="User directory" description="Review accounts, roles, and access status for the selected school." />
    {users.isError && <Notice>{users.error.message}</Notice>}
    <form onSubmit={submitSearch} className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="block w-full max-w-md"><span className="mb-2 block text-xs font-bold text-[#40564a]">Search accounts</span><span className="relative block"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718077]" /><input className={`${inputClass} pl-9`} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Email or phone" /></span></label>
      <label className="block w-full sm:w-52"><span className="mb-2 block text-xs font-bold text-[#40564a]">Role</span><select className={inputClass} value={role} onChange={(event) => { setRole(event.target.value); setPage(1) }}><option value="">All roles</option>{['ADMIN', 'MANAGER', 'TEACHER', 'STAFF', 'STUDENT', 'PARENT', 'BURSAR', 'SUPER_ADMIN'].map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>
      <Button type="submit" variant="secondary" icon={<Search className="h-4 w-4" aria-hidden="true" />}>Search</Button>
    </form>
    <Table headers={['Account', 'Role', 'Provider', 'Status', 'Last sign-in', 'Created']} empty="No accounts match these filters." isPending={users.isPending}>
      {rows.map((account) => <tr key={account.id}><Cell><span className="font-semibold">{account.email}</span><span className="mt-1 block text-xs text-[#718077]">{account.phone || 'No phone'} · {account.id}</span></Cell><Cell><span className="rounded-full bg-[#eef3e9] px-2.5 py-1 text-xs font-bold text-[#49604f]">{account.role.replaceAll('_', ' ')}</span></Cell><Cell>{account.authProvider || 'LOCAL'}</Cell><Cell><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${account.isActive ? 'bg-[#eef4dd] text-[#526d2d]' : 'bg-[#fff0ed] text-[#9b3d30]'}`}>{account.isActive ? 'Active' : 'Inactive'}</span>{account.mustChangePassword && <span className="mt-1 block text-xs text-[#8b6845]">Password reset required</span>}</Cell><Cell>{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : 'Never'}</Cell><Cell>{new Date(account.createdAt).toLocaleDateString()}</Cell></tr>)}
    </Table>
    <div className="mt-4 flex items-center justify-between"><p className="text-xs text-[#63746a]">{result?.total ?? 0} accounts</p><div className="flex items-center gap-3">{pageCount(page, result?.totalPages)}<Button type="button" variant="secondary" className="px-3 py-2" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button type="button" variant="secondary" className="px-3 py-2" disabled={page >= (result?.totalPages || 1)} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>
  </>
}

export function AuditLogsPage() {
  const { selectedSchoolId } = useOutletContext()
  const [filters, setFilters] = useState({ from: '', to: '', action: '', entityType: '' })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [page, setPage] = useState(1)
  const pageSize = 25
  const audit = useTenantQuery(
    `audit:${page}:${JSON.stringify(appliedFilters)}`,
    () => auditApi.list({ page, pageSize, ...Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value)) }),
  )
  const rows = audit.data?.data || []
  const pagination = audit.data?.pagination

  function applyFilters(event) {
    event.preventDefault()
    setPage(1)
    setAppliedFilters({
      ...filters,
      ...(filters.to ? { to: `${filters.to}T23:59:59.999` } : {}),
    })
  }

  if (!selectedSchoolId) return <EmptySelection />
  return <>
    <Heading eyebrow="Governance" title="Audit logs" description="Immutable history of school actions, actors, records, and timestamps." />
    {audit.isError && <Notice>{audit.error.message}</Notice>}
    <form onSubmit={applyFilters} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[180px_180px_1fr_1fr_auto] xl:items-end">
      <label className="block"><span className="mb-2 block text-xs font-bold text-[#40564a]">From</span><input className={inputClass} type="date" value={filters.from} onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} /></label>
      <label className="block"><span className="mb-2 block text-xs font-bold text-[#40564a]">To</span><input className={inputClass} type="date" value={filters.to} onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} /></label>
      <label className="block"><span className="mb-2 block text-xs font-bold text-[#40564a]">Action</span><input className={inputClass} value={filters.action} onChange={(event) => setFilters((value) => ({ ...value, action: event.target.value }))} placeholder="e.g. UPDATE" /></label>
      <label className="block"><span className="mb-2 block text-xs font-bold text-[#40564a]">Record type</span><input className={inputClass} value={filters.entityType} onChange={(event) => setFilters((value) => ({ ...value, entityType: event.target.value }))} placeholder="e.g. Student" /></label>
      <Button type="submit" icon={<FileClock className="h-4 w-4" aria-hidden="true" />}>Apply</Button>
    </form>
    <Table headers={['When', 'Action', 'Actor', 'Record', 'Details']} empty="No audit events match the selected filters." isPending={audit.isPending} minWidth="min-w-[820px]">
      {rows.map((entry) => <tr key={entry.id}><Cell className="whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</Cell><Cell><span className="rounded-full bg-[#eef3e9] px-2.5 py-1 text-xs font-bold text-[#49604f]">{entry.action}</span></Cell><Cell className="max-w-52 break-all">{entry.actorId || 'System'}</Cell><Cell><span className="font-semibold">{entry.entityType || '—'}</span><span className="mt-1 block break-all text-xs text-[#718077]">{entry.entityId || ''}</span></Cell><Cell className="max-w-[360px]"><details><summary className="cursor-pointer text-xs font-semibold text-[#52675a]">View metadata</summary><pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#f3f5f1] p-3 text-[11px] text-[#46584d]">{JSON.stringify(entry.metadata ?? {}, null, 2)}</pre></details></Cell></tr>)}
    </Table>
    <div className="mt-4 flex items-center justify-between"><p className="text-xs text-[#63746a]">{pagination?.total ?? 0} audit events</p><div className="flex items-center gap-3">{pageCount(page, pagination?.totalPages)}<Button type="button" variant="secondary" className="px-3 py-2" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button type="button" variant="secondary" className="px-3 py-2" disabled={page >= (pagination?.totalPages || 1)} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>
  </>
}

export function ReportCardsPage() {
  const { selectedSchoolId } = useOutletContext()
  const [termId, setTermId] = useState('')
  const [rankBy, setRankBy] = useState('STREAM')
  const [activeJobId, setActiveJobId] = useState('')
  const years = useTenantQuery('report-years', () => academicsApi.listYears({ pageSize: 100 }))
  const terms = (years.data?.data?.items || []).flatMap((year) => (year.terms || []).map((term) => ({ ...term, yearName: year.name })))
  const reports = useTenantQuery(`report-cards:${termId}:${rankBy}`, () => reportCardApi.listForTerm(termId, { rankBy }), Boolean(termId))
  const pdf = useMutation({
    mutationFn: ({ selectedTermId, studentId }) => reportCardApi.queuePdf(selectedTermId, studentId),
    onSuccess: ({ data }) => setActiveJobId(data.jobId),
  })
  const job = useTenantQuery(`report-pdf-job:${activeJobId}`, () => jobsApi.get(activeJobId), Boolean(activeJobId))
  const result = reports.data?.data
  const reportRows = result?.reports || []
  const jobData = job.data?.data

  if (!selectedSchoolId) return <EmptySelection />
  return <>
    <Heading eyebrow="Teaching & learning" title="Report cards" description="Review term results, curriculum-specific assessment summaries, and rank groups. PDF generation runs as a tracked job." />
    <div className="mb-6 grid gap-3 sm:grid-cols-[minmax(240px,360px)_220px]">
      <label className="block"><span className="mb-2 block text-xs font-bold text-[#40564a]">Academic term</span><select className={inputClass} value={termId} onChange={(event) => setTermId(event.target.value)}><option value="">Select a term</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.yearName} · {term.name}</option>)}</select></label>
      <label className="block"><span className="mb-2 block text-xs font-bold text-[#40564a]">Rank students by</span><select className={inputClass} value={rankBy} onChange={(event) => setRankBy(event.target.value)}><option value="STREAM">Stream</option><option value="CLASS_LEVEL">Class level</option></select></label>
    </div>
    {years.isError && <Notice>{years.error.message}</Notice>}{reports.isError && <Notice>{reports.error.message}</Notice>}{pdf.isError && <Notice>{pdf.error.message}</Notice>}{job.isError && <Notice>{job.error.message}</Notice>}
    {jobData && <div className="mb-5 rounded-md border border-[#d7dfd8] bg-white px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#263b31]">PDF report job</p><p className="mt-1 break-all text-xs text-[#718077]">{jobData.id}</p></div><span className="rounded-full bg-[#eef4dd] px-2.5 py-1 text-xs font-bold text-[#526d2d]">{jobData.status}</span></div>{jobData.error && <p className="mt-2 text-xs text-[#9b3d30]">{jobData.error}</p>}</div>}
    {result && <div className="mb-4 flex flex-wrap gap-3 text-xs font-semibold text-[#52675a]"><span className="rounded-md bg-white px-3 py-2">{result.term?.academicYear} · {result.term?.name}</span><span className="rounded-md bg-white px-3 py-2">{result.classSize} learners in rank groups</span></div>}
    {!termId ? <p className={muted}>Select a term to load report cards.</p> : <Table headers={['Learner', 'Class / stream', 'Subjects', 'Overall average', 'Rank', 'Report']} empty="No enrolled learners are available for this term." isPending={reports.isPending} minWidth="min-w-[820px]">
      {reportRows.map((report) => <tr key={report.student.id}><Cell><span className="font-semibold">{report.student.firstName} {report.student.middleName || ''} {report.student.lastName}</span><span className="mt-1 block text-xs text-[#718077]">{report.student.admissionNo}</span></Cell><Cell>{report.enrollment.classLevel}<span className="mt-1 block text-xs text-[#718077]">{report.enrollment.stream}</span></Cell><Cell>{report.subjects.length}<details className="mt-1"><summary className="cursor-pointer text-xs font-semibold text-[#52675a]">View marks</summary><ul className="mt-2 space-y-1 text-xs">{report.subjects.map((subject) => <li key={subject.subject.id} className="flex justify-between gap-4"><span>{subject.subject.name}</span><span>{subject.average === null ? '—' : `${subject.average.toFixed(1)}%`}</span></li>)}</ul>{report.cbc.length > 0 && <div className="mt-2 border-t border-[#edf0eb] pt-2 text-xs"><p className="font-bold">CBC assessments</p>{report.cbc.map((area) => <p key={area.learningArea.id} className="mt-1">{area.learningArea.name}: {area.totalAssessments} assessments</p>)}</div>}</details></Cell><Cell className="font-semibold">{report.overallAverage === null ? '—' : `${report.overallAverage.toFixed(1)}%`}</Cell><Cell>{report.classRank ? `${report.classRank} / ${report.rankGroupSize}` : 'Unranked'}</Cell><Cell><Button type="button" variant="secondary" className="px-3 py-2" isPending={pdf.isPending && pdf.variables?.studentId === report.student.id} icon={<Download className="h-4 w-4" aria-hidden="true" />} onClick={() => pdf.mutate({ selectedTermId: termId, studentId: report.student.id })}>Queue PDF</Button></Cell></tr>)}
    </Table>}
  </>
}