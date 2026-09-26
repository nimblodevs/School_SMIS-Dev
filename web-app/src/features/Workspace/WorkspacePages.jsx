import { Children, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Camera, Pencil, Plus, Save, Search } from 'lucide-react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { academicsApi, parentApi, schoolApi, storageApi, studentApi } from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'

const controlClass = 'w-full rounded-md border border-[#cbd6ce] bg-white px-3.5 py-3 text-sm text-[#17211b] shadow-sm outline-none transition placeholder:text-[#8b998e] focus:border-[#183d35] focus:ring-4 focus:ring-[#d3e77a]/25'
const muted = 'text-sm leading-6 text-[#63746a]'

function useTenantQuery(name, queryFn, enabled = true) {
  const { selectedSchoolId } = useOutletContext()
  return useQuery({
    queryKey: ['tenant', selectedSchoolId, name],
    queryFn,
    enabled: Boolean(selectedSchoolId) && enabled,
  })
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="mb-8 flex flex-col gap-5 border-b border-[#d7dfd8] pb-7 sm:flex-row sm:items-end sm:justify-between">
    <div><p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b34d3d]">{eyebrow}</p><h1 className="font-serif text-4xl leading-tight text-[#183d35]">{title}</h1>{description && <p className={`mt-2.5 max-w-2xl ${muted}`}>{description}</p>}</div>
    {action}
  </div>
}

function SectionTitle({ title, detail, action }) {
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-bold text-[#263b31]">{title}</h2>{detail && <p className="mt-1 text-xs leading-5 text-[#718077]">{detail}</p>}</div>{action}</div>
}

function Field({ label, children, className = '' }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-xs font-bold text-[#40564a]">{label}</span>{children}</label>
}

function TextInput({ label, name, type = 'text', required = false, defaultValue, placeholder, className = '' }) {
  return <Field label={label} className={className}><input className={controlClass} name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} /></Field>
}

function SelectInput({ label, name, options, required = false, placeholder = 'Select an option', className = '', defaultValue }) {
  return <Field label={label} className={className}><select className={controlClass} name={name} required={required} defaultValue={defaultValue || ''}><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
}

function Notice({ children, tone = 'error' }) {
  const styles = tone === 'success'
    ? 'border-[#bfd08e] bg-[#f2f7e4] text-[#3c5830]'
    : 'border-[#e9b5a9] bg-[#fff4f0] text-[#8f3a2e]'
  return <div role="status" className={`mb-5 rounded-md border px-4 py-3.5 text-sm leading-5 ${styles}`}>{children}</div>
}

function TableFrame({ headers, children, empty, isLoading }) {
  if (isLoading) return <p className={`py-8 text-center ${muted}`}>Loading records...</p>
  if (!Children.count(children)) return <div className="border-y border-[#dce2d8] px-4 py-12 text-center"><p className={`font-medium ${muted}`}>{empty || 'No records found.'}</p></div>
  return <div className="overflow-x-auto rounded-md border border-[#d7dfd8] bg-white"><table className="w-full min-w-[620px] border-collapse text-left text-sm"><thead><tr className="border-b border-[#d7dfd8] bg-[#f1f5f0]">{headers.map((header) => <th key={header} className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#63746a]">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#edf0eb] [&_tr]:transition-colors [&_tr:hover]:bg-[#f8faf7]">{children}</tbody></table></div>
}

function TableCell({ children, className = '' }) {
  return <td className={`px-4 py-3.5 text-[#34463b] ${className}`}>{children}</td>
}

function DetailValue({ label, value }) {
  return <div className="min-w-0 border-b border-[#edf0eb] py-3"><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718077]">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-[#263b31]">{value || '—'}</dd></div>
}

function ProfilePhoto({ relatedType, relatedId, name, tenantId, canView = true, canManage = false }) {
  const { selectedSchoolId } = useOutletContext()
  const requestSchoolId = tenantId || selectedSchoolId
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const photoQuery = useQuery({
    queryKey: ['tenant', requestSchoolId, 'profile-photo', relatedType, relatedId],
    queryFn: () => storageApi.getEntityFiles(relatedType, relatedId, requestSchoolId),
    enabled: Boolean(requestSchoolId && relatedId && canView),
  })
  const upload = useMutation({
    mutationFn: async (file) => {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.')
      const { data: grant } = await storageApi.createUploadUrl({
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        relatedType,
        relatedId,
      }, requestSchoolId)
      const response = await fetch(grant.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!response.ok) throw new Error(`Image upload failed (${response.status}).`)
      const { data } = await storageApi.registerUpload({
        fileName: file.name,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storageKey: grant.storageKey,
        relatedType,
        relatedId,
      }, requestSchoolId)
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant', requestSchoolId, 'profile-photo', relatedType, relatedId] })
    },
  })
  const photo = photoQuery.data?.data?.[0]
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return <div className="flex items-center gap-4">
    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-[#d7dfd8] bg-[#eaf0e7] text-xl font-bold text-[#315643]">
      {photo?.downloadUrl ? <img src={photo.downloadUrl} alt={`${name} profile`} className="h-full w-full object-cover" /> : <span>{initials || '?'}</span>}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718077]">Profile photo</p>
      {canManage && <>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Choose ${name} profile photo`} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) upload.mutate(file); event.currentTarget.value = '' }} />
        <Button type="button" variant="secondary" className="mt-2 px-3 py-2" isPending={upload.isPending} icon={<Camera className="h-4 w-4" aria-hidden="true" />} onClick={() => inputRef.current?.click()}>{photo ? 'Change photo' : 'Add photo'}</Button>
      </>}
      {upload.isError && <p role="alert" className="mt-2 max-w-xs text-xs text-[#9b3d30]">{upload.error.message}</p>}
      {photoQuery.isError && <p className="mt-2 max-w-xs text-xs text-[#8b6845]">Photo storage is unavailable.</p>}
      {photoQuery.isPending && <p className="mt-2 text-xs text-[#718077]">Loading photo…</p>}
    </div>
  </div>
}

function EmptySelection() {
  return <div className="grid min-h-72 place-items-center rounded-md border border-dashed border-[#bdcbbf] bg-white px-6 text-center"><div><p className="font-serif text-2xl text-[#183d35]">Select a school</p><p className={`mt-2 ${muted}`}>Choose an active school from the header to view its records.</p></div></div>
}

function useTenantId() {
  return useOutletContext().selectedSchoolId
}

export function DashboardPage() {
  const { selectedSchoolId, selectedSchool, user } = useOutletContext()
  const students = useTenantQuery('dashboard-students', () => studentApi.list({ pageSize: 100 }))
  const parents = useTenantQuery('dashboard-parents', () => parentApi.list({ pageSize: 100 }))
  const years = useTenantQuery('dashboard-years', () => academicsApi.listYears({ pageSize: 100 }))
  const studentRows = students.data?.data || []
  const recentStudents = studentRows.slice(0, 6)
  const metrics = [
    { label: 'Students', value: students.data?.pagination?.total ?? '—', note: 'Enrolled learner records' },
    { label: 'Parent profiles', value: parents.data?.pagination?.total ?? '—', note: 'Linked family contacts' },
    { label: 'Academic years', value: years.data?.data?.total ?? '—', note: 'Configured for this school' },
    { label: 'Active school', value: selectedSchool?.isActive === false ? 'Inactive' : selectedSchoolId ? 'Active' : 'Select', note: selectedSchool?.schoolCode ? `School code ${selectedSchool.schoolCode}` : 'Current tenant context' },
  ]

  if (!selectedSchoolId) return <><PageHeading eyebrow="Platform overview" title="Welcome to School SMIS" description="Create a school or select an active tenant to open its workspace." />{user?.role === 'SUPER_ADMIN' && <p className={muted}>Use the school directory to register a school, then select it from the header.</p>}</>

  return <>
    <PageHeading eyebrow="School operations" title={`Good to see you, ${user?.firstName || user?.username || 'there'}.`} description="A current view of the school’s learner, family, and academic records." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => <section key={metric.label} className="relative overflow-hidden rounded-md border border-[#d7dfd8] bg-white px-5 py-5 shadow-[0_2px_8px_rgba(24,61,53,0.035)]"><span className={`absolute inset-x-0 top-0 h-1 ${index === 1 ? 'bg-[#d3e77a]' : index === 2 ? 'bg-[#d78b68]' : 'bg-[#5e8874]'}`} /><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#63746a]">{metric.label}</p><span className={`h-2 w-2 rounded-full ${index === 3 && metric.value === 'Inactive' ? 'bg-[#b34d3d]' : 'bg-[#9ab545]'}`} /></div><p className="mt-4 font-serif text-3xl text-[#183d35]">{metric.value}</p><p className="mt-1 text-xs text-[#718077]">{metric.note}</p></section>)}
    </div>
    <section className="mt-9">
      <SectionTitle title="Recent admissions" detail="Latest learners in the selected school" />
      {students.isError && <Notice>{students.error.message}</Notice>}
      <TableFrame headers={['Admission no.', 'Learner', 'Placement', 'Status']} empty="No learners have been admitted yet." isLoading={students.isPending}>
        {recentStudents.map((student) => {
          const placement = student.enrollments?.[0]
          return <tr key={student.id}><TableCell className="font-semibold">{student.admissionNo}</TableCell><TableCell>{student.firstName} {student.middleName || ''} {student.lastName}</TableCell><TableCell>{placement?.stream?.classLevel?.name || 'Unplaced'}{placement?.stream?.name ? ` · ${placement.stream.name}` : ''}</TableCell><TableCell><span className="rounded-full bg-[#eef4dd] px-2.5 py-1 text-xs font-bold text-[#526d2d]">{student.isActive ? 'Active' : 'Inactive'}</span></TableCell></tr>
        })}
      </TableFrame>
    </section>
  </>
}

export function SchoolsPage() {
  const navigate = useNavigate()
  const { isSuperAdmin, selectedSchoolId, changeSchool } = useOutletContext()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [notice, setNotice] = useState(null)
  const schools = useQuery({ queryKey: ['platform', 'schools'], queryFn: () => schoolApi.list({ pageSize: 100 }), enabled: isSuperAdmin })
  const create = useMutation({
    mutationFn: schoolApi.create,
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ['platform', 'schools'] })
      changeSchool(data.data.id)
      setIsCreating(false)
      setNotice(`Created ${data.data.name}.`)
    },
  })
  if (!isSuperAdmin) return <><PageHeading eyebrow="Schools" title="School directory" /><Notice>You do not have access to the platform school directory.</Notice></>

  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    create.mutate(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '')))
  }

  const rows = schools.data?.data?.schools || []
  return <>
    <PageHeading eyebrow="Platform administration" title="School directory" description="Manage school tenants and open a school’s workspace." action={<Button type="button" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setNotice(null); setIsCreating((value) => !value) }}>Add school</Button>} />
    {notice && <Notice tone="success">{notice}</Notice>}
    {create.isError && <Notice>{create.error.message}</Notice>}
    {isCreating && <form onSubmit={submit} className="mb-7 border-y border-[#dce2d8] bg-white py-5">
      <SectionTitle title="Register a school" detail="A unique name and URL slug are required." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><TextInput label="School name" name="name" required /><TextInput label="URL slug" name="slug" required placeholder="green-valley-school" /><TextInput label="Email" name="email" type="email" /><TextInput label="Phone" name="phone" type="tel" /><TextInput label="City" name="city" /><TextInput label="County" name="county" /></div>
      <div className="mt-4 flex justify-end"><Button type="submit" isPending={create.isPending}>Create school</Button></div>
    </form>}
    {schools.isError && <Notice>{schools.error.message}</Notice>}
    <TableFrame headers={['School', 'Code', 'Location', 'Learners', 'Staff', 'Status', 'Actions']} empty="No schools are registered yet." isLoading={schools.isPending}>
      {rows.map((school) => <tr
        key={school.id}
        tabIndex={0}
        aria-label={`View ${school.name} details`}
        onClick={() => navigate(`/workspace/schools/${school.id}`)}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            navigate(`/workspace/schools/${school.id}`)
          }
        }}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#78936d]"
      >
        <TableCell className="font-semibold"><span className="text-[#183d35]">{school.name}</span><span className="mt-0.5 block text-xs font-normal text-[#7c8a80]">{school.slug}</span></TableCell>
        <TableCell>{school.schoolCode}</TableCell>
        <TableCell>{[school.city, school.county].filter(Boolean).join(', ') || '—'}</TableCell>
        <TableCell>{school._count?.students ?? 0}</TableCell>
        <TableCell>{(school._count?.teachers ?? 0) + (school._count?.staff ?? 0)}</TableCell>
        <TableCell><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${school.isActive ? 'bg-[#eef4dd] text-[#526d2d]' : 'bg-[#fff0ed] text-[#9b3d30]'}`}>{school.isActive ? 'Active' : 'Inactive'}</span></TableCell>
        <TableCell><div className="flex items-center gap-1.5">
          <button type="button" title={`Edit ${school.name}`} aria-label={`Edit ${school.name}`} onClick={(event) => { event.stopPropagation(); navigate(`/workspace/schools/${school.id}/edit`) }} className="grid h-9 w-9 place-items-center rounded-md border border-[#d7dfd8] text-[#52675a] hover:bg-[#f3f6f2]"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
          <Button type="button" variant="secondary" className="px-3 py-2" disabled={!school.isActive} onClick={(event) => { event.stopPropagation(); changeSchool(school.id) }}>{selectedSchoolId === school.id ? 'Selected' : 'Open workspace'}</Button>
        </div></TableCell>
      </tr>)}
    </TableFrame>
  </>
}

export function SchoolDetailsPage() {
  const navigate = useNavigate()
  const { schoolId } = useParams()
  const { user, isSuperAdmin, selectedSchoolId, changeSchool } = useOutletContext()
  const schoolQuery = useQuery({
    queryKey: ['school-profile', schoolId],
    queryFn: () => schoolApi.getById(schoolId),
    enabled: Boolean(schoolId),
  })
  const school = schoolQuery.data?.data
  const canEdit = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role)
  const employeeCount = (school?._count?.teachers || 0) + (school?._count?.staff || 0)

  return <>
    <PageHeading
      eyebrow="School profile"
      title={school?.name || 'School details'}
      description="School identity, contact information, and current platform activity."
      action={<div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => navigate(isSuperAdmin ? '/workspace/schools' : '/workspace')}>Back to {isSuperAdmin ? 'directory' : 'workspace'}</Button>
        {canEdit && school && <Button type="button" icon={<Pencil className="h-4 w-4" aria-hidden="true" />} onClick={() => navigate(`/workspace/schools/${schoolId}/edit`)}>Edit school</Button>}
      </div>}
    />
    {schoolQuery.isPending && <p className={muted}>Loading school profile...</p>}
    {schoolQuery.isError && <Notice>{schoolQuery.error.message}</Notice>}
    {school && <>
      <section className="mb-6 flex flex-col justify-between gap-5 rounded-md border border-[#d7dfd8] bg-white p-5 sm:flex-row sm:items-center sm:p-6">
        <ProfilePhoto relatedType="SCHOOL_PROFILE_PHOTO" relatedId={school.id} tenantId={school.id} name={school.name} canView={['ADMIN', 'SUPER_ADMIN'].includes(user?.role)} />
        <div className="flex min-w-0 items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-[#eaf0e7] text-[#315643]"><Building2 className="h-6 w-6" aria-hidden="true" /></span><div className="min-w-0"><p className="truncate text-lg font-bold text-[#183d35]">{school.name}</p><p className="mt-1 text-sm text-[#63746a]">{school.slug} · School code {school.schoolCode}</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${school.isActive ? 'bg-[#eef4dd] text-[#526d2d]' : 'bg-[#fff0ed] text-[#9b3d30]'}`}>{school.isActive ? 'Active' : 'Inactive'}</span>{isSuperAdmin && school.isActive && selectedSchoolId !== school.id && <Button type="button" variant="secondary" onClick={() => { changeSchool(school.id); navigate('/workspace') }}>Open workspace</Button>}</div>
      </section>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Students', school._count?.students ?? 0],
          ['Parents / guardians', school._count?.parents ?? 0],
          ['Teachers', school._count?.teachers ?? 0],
          ['Staff', school._count?.staff ?? 0],
        ].map(([label, value]) => <section key={label} className="rounded-md border border-[#d7dfd8] bg-white px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#63746a]">{label}</p><p className="mt-2 font-serif text-3xl text-[#183d35]">{value}</p></section>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border border-[#d7dfd8] bg-white px-5 py-5 sm:px-6"><SectionTitle title="Contact & location" /><dl className="grid gap-x-7 sm:grid-cols-2"><DetailValue label="Email" value={school.email} /><DetailValue label="Phone" value={school.phone} /><DetailValue label="Website" value={school.website} /><DetailValue label="Address" value={school.address} /><DetailValue label="City" value={school.city} /><DetailValue label="County" value={school.county} /><DetailValue label="Postal code" value={school.postalCode} /></dl></section>
        <section className="rounded-md border border-[#d7dfd8] bg-white px-5 py-5 sm:px-6"><SectionTitle title="School profile" /><dl className="grid gap-x-7 sm:grid-cols-2"><DetailValue label="Motto" value={school.motto} /><DetailValue label="Created" value={new Date(school.createdAt).toLocaleDateString()} /><DetailValue label="Vision" value={school.vision} /><DetailValue label="Mission" value={school.mission} /><DetailValue label="Total employees" value={employeeCount} /><DetailValue label="School ID" value={school.id} /></dl></section>
      </div>
    </>}
  </>
}

export function SchoolEditPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { schoolId } = useParams()
  const { user } = useOutletContext()
  const canEditIdentity = user?.role === 'SUPER_ADMIN'
  const canManagePhoto = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role)
  const schoolQuery = useQuery({
    queryKey: ['school-profile', schoolId],
    queryFn: () => schoolApi.getById(schoolId),
    enabled: Boolean(schoolId),
  })
  const school = schoolQuery.data?.data
  const update = useMutation({
    mutationFn: (body) => schoolApi.update(schoolId, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-profile', schoolId] }),
        queryClient.invalidateQueries({ queryKey: ['platform', 'schools'] }),
      ])
      navigate(`/workspace/schools/${schoolId}`)
    },
  })

  function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    const body = Object.fromEntries(
      ['motto', 'vision', 'mission', 'address', 'city', 'county', 'postalCode', 'website']
        .map((field) => [field, values[field] || null]),
    )
    if (canEditIdentity) {
      body.name = values.name
      body.slug = values.slug
      body.email = values.email || null
      body.phone = values.phone || null
      body.isActive = form.elements.isActive.checked
    }
    update.mutate(body)
  }

  return <>
    <PageHeading eyebrow="School profile" title={`Edit ${school?.name || 'school'}`} description="Update school information. Generated school codes and tenant IDs are protected." action={<Button type="button" variant="secondary" onClick={() => navigate(`/workspace/schools/${schoolId}`)}>Cancel</Button>} />
    {schoolQuery.isPending && <p className={muted}>Loading school profile...</p>}
    {schoolQuery.isError && <Notice>{schoolQuery.error.message}</Notice>}
    {update.isError && <Notice>{update.error.message}</Notice>}
    {school && <form key={school.id} onSubmit={submit} className="max-w-5xl rounded-md border border-[#d7dfd8] bg-white p-5 shadow-[0_2px_8px_rgba(24,61,53,0.035)] sm:p-6">
      {!canEditIdentity && <p className="mb-5 rounded-md bg-[#f3f5f1] px-4 py-3 text-xs leading-5 text-[#63746a]">Only platform administrators can change the school name, URL slug, email, phone, or active status.</p>}
      <div className="mb-6 rounded-md bg-[#f6f8f4] p-4"><ProfilePhoto relatedType="SCHOOL_PROFILE_PHOTO" relatedId={school.id} tenantId={school.id} name={school.name} canView={canManagePhoto} canManage={canManagePhoto} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {canEditIdentity && <><TextInput label="School name" name="name" required defaultValue={school.name} /><TextInput label="URL slug" name="slug" required defaultValue={school.slug} /><TextInput label="Email" name="email" type="email" defaultValue={school.email || ''} /><TextInput label="Phone" name="phone" type="tel" defaultValue={school.phone || ''} /></>}
        <TextInput label="Website" name="website" type="url" defaultValue={school.website || ''} />
        <TextInput label="Address" name="address" defaultValue={school.address || ''} />
        <TextInput label="City" name="city" defaultValue={school.city || ''} />
        <TextInput label="County" name="county" defaultValue={school.county || ''} />
        <TextInput label="Postal code" name="postalCode" defaultValue={school.postalCode || ''} />
        <TextInput label="Motto" name="motto" defaultValue={school.motto || ''} />
        <TextInput label="Vision" name="vision" defaultValue={school.vision || ''} />
        <TextInput label="Mission" name="mission" defaultValue={school.mission || ''} />
      </div>
      {canEditIdentity && <label className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#40564a]"><input type="checkbox" name="isActive" defaultChecked={school.isActive} className="h-4 w-4 accent-[#183d35]" />School is active</label>}
      <div className="mt-6 flex justify-end"><Button type="submit" isPending={update.isPending} icon={<Save className="h-4 w-4" aria-hidden="true" />}>Save changes</Button></div>
    </form>}
  </>
}

export function StudentsPage() {
  const navigate = useNavigate()
  const schoolId = useTenantId()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showAdmission, setShowAdmission] = useState(false)
  const [notice, setNotice] = useState(null)
  const students = useTenantQuery(`students:${search}`, () => studentApi.list({ pageSize: 100, ...(search ? { search } : {}) }))
  const years = useTenantQuery('admission-years', () => academicsApi.listYears({ pageSize: 100 }))
  const classes = useTenantQuery('admission-classes', () => academicsApi.listClasses({ pageSize: 200 }))
  const parents = useTenantQuery('admission-parents', () => parentApi.list({ pageSize: 100 }))
  const create = useMutation({
    mutationFn: studentApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant', schoolId, 'students'] })
      setNotice('Student admitted successfully.')
      setShowAdmission(false)
    },
  })
  const rows = students.data?.data || []
  const yearsList = years.data?.data?.items || []
  const streams = (classes.data?.data?.items || []).flatMap((level) => (level.streams || []).map((stream) => ({ ...stream, levelName: level.name })))
  const parentRows = parents.data?.data || []

  function submitAdmission(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const body = {
      firstName: values.firstName,
      middleName: values.middleName || undefined,
      lastName: values.lastName,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth,
      nationalIdNumber: values.nationalIdNumber,
      birthCertificateNumber: values.birthCertificateNumber,
      passportNumber: values.passportNumber || undefined,
      academicYearId: values.academicYearId,
      streamId: values.streamId,
      ...(values.parentId ? { parents: [{ parentId: values.parentId }] } : {}),
    }
    create.mutate(body)
  }

  if (!schoolId) return <EmptySelection />
  return <>
    <PageHeading eyebrow="Learner records" title="Students" description="Search the school register or admit a learner with an initial class placement." action={<Button type="button" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setNotice(null); setShowAdmission((value) => !value) }}>Admit student</Button>} />
    {notice && <Notice tone="success">{notice}</Notice>}{create.isError && <Notice>{create.error.message}</Notice>}
    {showAdmission && <form onSubmit={submitAdmission} className="mb-8 border-y border-[#dce2d8] bg-white py-5">
      <SectionTitle title="New admission" detail="Student record, academic year, and stream are required." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <TextInput label="First name" name="firstName" required /><TextInput label="Middle name" name="middleName" /><TextInput label="Last name" name="lastName" required />
        <SelectInput label="Gender" name="gender" required options={['FEMALE', 'MALE', 'OTHER'].map((value) => ({ value, label: value[0] + value.slice(1).toLowerCase() }))} />
        <TextInput label="Date of birth" name="dateOfBirth" type="date" required /><TextInput label="National ID" name="nationalIdNumber" required />
        <TextInput label="Birth certificate number" name="birthCertificateNumber" required /><TextInput label="Passport number" name="passportNumber" />
        <SelectInput label="Academic year" name="academicYearId" required options={yearsList.map((year) => ({ value: year.id, label: year.name }))} />
        <SelectInput label="Class / stream" name="streamId" required options={streams.map((stream) => ({ value: stream.id, label: `${stream.levelName} · ${stream.name}` }))} />
        <SelectInput label="Link parent (optional)" name="parentId" options={parentRows.map((parent) => ({ value: parent.id, label: `${parent.firstName} ${parent.lastName} · ${parent.phone}` }))} />
      </div>
      {!yearsList.length || !streams.length ? <p className="mt-4 text-sm text-[#9b3d30]">Set up an academic year and class stream before admitting students.</p> : null}
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="quiet" onClick={() => setShowAdmission(false)}>Cancel</Button><Button type="submit" isPending={create.isPending} disabled={!yearsList.length || !streams.length}>Save admission</Button></div>
    </form>}
    <div className="mb-4 flex max-w-md items-center gap-2 border-b border-[#bac8ba] pb-2"><Search className="h-4 w-4 text-[#718077]" aria-hidden="true" /><input aria-label="Search students" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or admission number" className="w-full bg-transparent text-sm outline-none placeholder:text-[#8b998e]" /></div>
    {students.isError && <Notice>{students.error.message}</Notice>}
    <TableFrame headers={['Admission no.', 'Learner', 'Class / stream', 'Year', 'Status', 'Actions']} empty="No students match this search." isLoading={students.isPending}>
      {rows.map((student) => { const enrollment = student.enrollments?.[0]; return <tr key={student.id} tabIndex={0} aria-label={`View ${student.firstName} ${student.lastName}`} onClick={() => navigate(`/workspace/students/${student.id}`)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/workspace/students/${student.id}`) } }} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#78936d]"><TableCell className="font-semibold">{student.admissionNo}</TableCell><TableCell><span className="text-[#183d35]">{student.firstName} {student.middleName || ''} {student.lastName}</span></TableCell><TableCell>{enrollment?.stream?.classLevel?.name || '—'}{enrollment?.stream?.name ? ` · ${enrollment.stream.name}` : ''}</TableCell><TableCell>{enrollment?.academicYear?.name || '—'}</TableCell><TableCell><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${student.isActive ? 'bg-[#eef4dd] text-[#526d2d]' : 'bg-[#fff0ed] text-[#9b3d30]'}`}>{student.isActive ? 'Active' : 'Inactive'}</span></TableCell><TableCell><button type="button" title={`Edit ${student.firstName} ${student.lastName}`} aria-label={`Edit ${student.firstName} ${student.lastName}`} onClick={(event) => { event.stopPropagation(); navigate(`/workspace/students/${student.id}/edit`) }} className="grid h-9 w-9 place-items-center rounded-md border border-[#d7dfd8] text-[#52675a] hover:bg-[#f3f6f2]"><Pencil className="h-4 w-4" aria-hidden="true" /></button></TableCell></tr> })}
    </TableFrame>
    <p className="mt-3 text-xs text-[#7c8a80]">{students.data?.data?.pagination?.total ?? 0} student records</p>
  </>
}

export function StudentDetailsPage() {
  const navigate = useNavigate()
  const { studentId } = useParams()
  const { user } = useOutletContext()
  const studentQuery = useTenantQuery(`student-profile:${studentId}`, () => studentApi.getById(studentId), Boolean(studentId))
  const student = studentQuery.data?.data
  const canEdit = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'TEACHER'].includes(user?.role) || (user?.modulePermissions || []).includes('STUDENTS')
  const enrollment = student?.enrollments?.[0]

  return <>
    <PageHeading
      eyebrow="Learner profile"
      title={student ? `${student.firstName} ${student.middleName || ''} ${student.lastName}` : 'Student profile'}
      description="Personal details, current placement, and linked family contacts."
      action={<div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => navigate('/workspace/students')}>Back to students</Button>{canEdit && student && <Button type="button" icon={<Pencil className="h-4 w-4" aria-hidden="true" />} onClick={() => navigate(`/workspace/students/${studentId}/edit`)}>Edit student</Button>}</div>}
    />
    {studentQuery.isPending && <p className={muted}>Loading student profile...</p>}
    {studentQuery.isError && <Notice>{studentQuery.error.message}</Notice>}
    {student && <>
      <section className="mb-6 flex flex-col justify-between gap-4 rounded-md border border-[#d7dfd8] bg-white p-5 sm:flex-row sm:items-center">
        <ProfilePhoto relatedType="STUDENT_PROFILE_PHOTO" relatedId={student.id} name={`${student.firstName} ${student.middleName || ''} ${student.lastName}`} canView />
        <div><p className="text-lg font-bold text-[#183d35]">{student.admissionNo}</p><p className="mt-1 text-sm text-[#63746a]">{enrollment?.stream?.classLevel?.name || 'No class'}{enrollment?.stream?.name ? ` · ${enrollment.stream.name}` : ''}{enrollment?.academicYear?.name ? ` · ${enrollment.academicYear.name}` : ''}</p></div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${student.isActive ? 'bg-[#eef4dd] text-[#526d2d]' : 'bg-[#fff0ed] text-[#9b3d30]'}`}>{student.isActive ? 'Active' : 'Inactive'}</span>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border border-[#d7dfd8] bg-white px-5 py-5 sm:px-6"><SectionTitle title="Personal information" /><dl className="grid gap-x-7 sm:grid-cols-2"><DetailValue label="Student ID" value={student.id} /><DetailValue label="Admission number" value={student.admissionNo} /><DetailValue label="Gender" value={student.gender} /><DetailValue label="Date of birth" value={String(student.dateOfBirth).slice(0, 10)} /><DetailValue label="Admission date" value={String(student.admissionDate).slice(0, 10)} /><DetailValue label="National ID" value={student.nationalIdNumber} /><DetailValue label="Birth certificate" value={student.birthCertificateNumber} /><DetailValue label="Passport number" value={student.passportNumber} /></dl></section>
        <section className="rounded-md border border-[#d7dfd8] bg-white px-5 py-5 sm:px-6"><SectionTitle title="Enrollment & family" /><dl className="grid gap-x-7 sm:grid-cols-2"><DetailValue label="Class level" value={enrollment?.stream?.classLevel?.name} /><DetailValue label="Stream" value={enrollment?.stream?.name} /><DetailValue label="Academic year" value={enrollment?.academicYear?.name} /><DetailValue label="Enrollment status" value={enrollment?.status} /><DetailValue label="Parents / guardians" value={student.parents?.map(({ parent }) => `${parent.firstName} ${parent.middleName || ''} ${parent.lastName} · ${parent.phone}`).join('; ')} /></dl></section>
      </div>
    </>}
  </>
}

export function StudentEditPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { studentId } = useParams()
  const { user, selectedSchoolId } = useOutletContext()
  const canEdit = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'TEACHER'].includes(user?.role) || (user?.modulePermissions || []).includes('STUDENTS')
  const studentQuery = useTenantQuery(`student-profile:${studentId}`, () => studentApi.getById(studentId), Boolean(studentId))
  const student = studentQuery.data?.data
  const update = useMutation({
    mutationFn: (body) => studentApi.update(studentId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant', selectedSchoolId] })
      navigate(`/workspace/students/${studentId}`)
    },
  })

  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    update.mutate({
      firstName: values.firstName,
      middleName: values.middleName || undefined,
      lastName: values.lastName,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth,
      nationalIdNumber: values.nationalIdNumber,
      birthCertificateNumber: values.birthCertificateNumber,
      passportNumber: values.passportNumber || undefined,
      isActive: event.currentTarget.elements.isActive.checked,
    })
  }

  return <>
    <PageHeading eyebrow="Learner profile" title={`Edit ${student ? `${student.firstName} ${student.lastName}` : 'student'}`} description="Update personal information and account status. Enrollment, admission number, and family links remain unchanged." action={<Button type="button" variant="secondary" onClick={() => navigate(`/workspace/students/${studentId}`)}>Cancel</Button>} />
    {studentQuery.isPending && <p className={muted}>Loading student profile...</p>}
    {studentQuery.isError && <Notice>{studentQuery.error.message}</Notice>}
    {update.isError && <Notice>{update.error.message}</Notice>}
    {student && (canEdit ? <form key={student.id} onSubmit={submit} className="max-w-5xl rounded-md border border-[#d7dfd8] bg-white p-5 shadow-[0_2px_8px_rgba(24,61,53,0.035)] sm:p-6">
      <p className="mb-5 text-xs text-[#63746a]">Admission number {student.admissionNo} · Current placement is managed through enrollment workflows.</p>
      <div className="mb-6 rounded-md bg-[#f6f8f4] p-4"><ProfilePhoto relatedType="STUDENT_PROFILE_PHOTO" relatedId={student.id} name={`${student.firstName} ${student.middleName || ''} ${student.lastName}`} canView canManage={canEdit} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <TextInput label="First name" name="firstName" required defaultValue={student.firstName} />
        <TextInput label="Middle name" name="middleName" defaultValue={student.middleName || ''} />
        <TextInput label="Last name" name="lastName" required defaultValue={student.lastName} />
        <SelectInput label="Gender" name="gender" required defaultValue={student.gender} options={['FEMALE', 'MALE', 'OTHER'].map((value) => ({ value, label: value[0] + value.slice(1).toLowerCase() }))} />
        <TextInput label="Date of birth" name="dateOfBirth" type="date" required defaultValue={String(student.dateOfBirth).slice(0, 10)} />
        <TextInput label="National ID" name="nationalIdNumber" required defaultValue={student.nationalIdNumber} />
        <TextInput label="Birth certificate number" name="birthCertificateNumber" required defaultValue={student.birthCertificateNumber} />
        <TextInput label="Passport number" name="passportNumber" defaultValue={student.passportNumber || ''} />
      </div>
      <label className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#40564a]"><input type="checkbox" name="isActive" defaultChecked={student.isActive} className="h-4 w-4 accent-[#183d35]" />Student is active</label>
      <div className="mt-6 flex justify-end"><Button type="submit" isPending={update.isPending} icon={<Save className="h-4 w-4" aria-hidden="true" />}>Save changes</Button></div>
    </form> : student && <Notice>You do not have permission to edit student profiles.</Notice>)}
  </>
}

export function ParentsPage() {
  const navigate = useNavigate()
  const schoolId = useTenantId()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState(null)
  const parents = useTenantQuery(`parents:${search}`, () => parentApi.list({ pageSize: 100, ...(search ? { search } : {}) }))
  const create = useMutation({
    mutationFn: parentApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant', schoolId, 'parents'] })
      setNotice('Parent profile created.')
      setShowForm(false)
    },
  })
  const rows = parents.data?.data || []
  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const profile = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))
    create.mutate({ ...profile, createPortalAccount: event.currentTarget.elements.createPortalAccount.checked })
  }

  if (!schoolId) return <EmptySelection />
  return <>
    <PageHeading eyebrow="Family directory" title="Parents & guardians" description="Maintain family contacts and parent profiles for this school." action={<Button type="button" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setNotice(null); setShowForm((value) => !value) }}>Add parent</Button>} />
    {notice && <Notice tone="success">{notice}</Notice>}{create.isError && <Notice>{create.error.message}</Notice>}
    {showForm && <form onSubmit={submit} className="mb-8 border-y border-[#dce2d8] bg-white py-5"><SectionTitle title="Register parent" detail="Create a portal account only when the parent should sign in." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><TextInput label="First name" name="firstName" required /><TextInput label="Middle name" name="middleName" /><TextInput label="Last name" name="lastName" required /><TextInput label="Phone" name="phone" type="tel" required /><TextInput label="Email" name="email" type="email" /><TextInput label="National ID" name="nationalIdNumber" required /><SelectInput label="Relationship" name="relation" defaultValue="GUARDIAN" options={['MOTHER', 'FATHER', 'GUARDIAN'].map((value) => ({ value, label: value[0] + value.slice(1).toLowerCase() }))} /><label className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#34463b]"><input type="checkbox" name="createPortalAccount" className="h-4 w-4 accent-[#183d35]" />Create portal account</label></div><div className="mt-5 flex justify-end"><Button type="submit" isPending={create.isPending}>Save parent</Button></div></form>}
    <div className="mb-4 flex max-w-md items-center gap-2 border-b border-[#bac8ba] pb-2"><Search className="h-4 w-4 text-[#718077]" aria-hidden="true" /><input aria-label="Search parents" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, phone, or email" className="w-full bg-transparent text-sm outline-none placeholder:text-[#8b998e]" /></div>
    {parents.isError && <Notice>{parents.error.message}</Notice>}
    <TableFrame headers={['Parent', 'Relationship', 'Phone', 'Email', 'Learners', 'Edit']} empty="No parent profiles match this search." isLoading={parents.isPending}>
      {rows.map((parent) => <tr key={parent.id} tabIndex={0} aria-label={`View ${parent.firstName} ${parent.lastName}`} onClick={() => navigate(`/workspace/parents/${parent.id}`)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/workspace/parents/${parent.id}`) } }} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#78936d]"><TableCell className="font-semibold"><span className="text-[#183d35]">{parent.firstName} {parent.middleName || ''} {parent.lastName}</span></TableCell><TableCell>{parent.relation}</TableCell><TableCell>{parent.phone}</TableCell><TableCell>{parent.email || '—'}</TableCell><TableCell>{parent.students?.map(({ student }) => `${student.firstName} ${student.lastName}`).join(', ') || '—'}</TableCell><TableCell><button type="button" title={`Edit ${parent.firstName} ${parent.lastName}`} aria-label={`Edit ${parent.firstName} ${parent.lastName}`} onClick={(event) => { event.stopPropagation(); navigate(`/workspace/parents/${parent.id}/edit`) }} className="grid h-9 w-9 place-items-center rounded-md border border-[#d7dfd8] text-[#52675a] hover:bg-[#f3f6f2]"><Pencil className="h-4 w-4" aria-hidden="true" /></button></TableCell></tr>)}
    </TableFrame>
  </>
}

export function ParentDetailsPage() {
  const navigate = useNavigate()
  const { parentId } = useParams()
  const { user } = useOutletContext()
  const parentQuery = useTenantQuery(`parent-profile:${parentId}`, () => parentApi.getById(parentId), Boolean(parentId))
  const parent = parentQuery.data?.data
  const canEdit = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(user?.role)
  const linkedStudents = parent?.students || []

  return <>
    <PageHeading
      eyebrow="Family profile"
      title={parent ? `${parent.firstName} ${parent.middleName || ''} ${parent.lastName}` : 'Parent profile'}
      description="Parent contact information and linked learners for this school."
      action={<div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => navigate('/workspace/parents')}>Back to families</Button>{canEdit && parent && <Button type="button" icon={<Pencil className="h-4 w-4" aria-hidden="true" />} onClick={() => navigate(`/workspace/parents/${parentId}/edit`)}>Edit parent</Button>}</div>}
    />
    {parentQuery.isPending && <p className={muted}>Loading parent profile...</p>}
    {parentQuery.isError && <Notice>{parentQuery.error.message}</Notice>}
    {parent && <>
      <section className="mb-6 flex flex-col gap-5 rounded-md border border-[#d7dfd8] bg-white p-5 sm:flex-row sm:items-center sm:p-6"><ProfilePhoto relatedType="PARENT_PROFILE_PHOTO" relatedId={parent.id} name={`${parent.firstName} ${parent.middleName || ''} ${parent.lastName}`} canView={canEdit} /><div><p className="text-lg font-bold text-[#183d35]">{parent.relation}</p><p className="mt-1 text-sm text-[#63746a]">{parent.phone}{parent.email ? ` · ${parent.email}` : ''}</p></div></section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-md border border-[#d7dfd8] bg-white px-5 py-5 sm:px-6"><SectionTitle title="Contact information" /><dl className="grid gap-x-7 sm:grid-cols-2"><DetailValue label="Parent ID" value={parent.id} /><DetailValue label="Relationship" value={parent.relation} /><DetailValue label="Phone" value={parent.phone} /><DetailValue label="Email" value={parent.email} /><DetailValue label="National ID" value={parent.nationalIdNumber} /></dl></section>
        <section className="rounded-md border border-[#d7dfd8] bg-white px-5 py-5 sm:px-6"><SectionTitle title="Linked learners" detail={`${linkedStudents.length} linked student${linkedStudents.length === 1 ? '' : 's'}`} />
          {!linkedStudents.length ? <p className={muted}>No learners are linked to this parent.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b border-[#d7dfd8] text-[10px] font-bold uppercase text-[#63746a]"><th className="py-3 pr-4">Student</th><th className="py-3 pr-4">Admission</th><th className="py-3">Contact designations</th></tr></thead><tbody className="divide-y divide-[#edf0eb]">{linkedStudents.map(({ student, ...link }) => <tr key={student.id}><td className="py-3 pr-4 font-semibold text-[#263b31]">{student.firstName} {student.middleName || ''} {student.lastName}</td><td className="py-3 pr-4 text-[#52675a]">{student.admissionNo}</td><td className="py-3 text-xs text-[#63746a]">{[link.isPrimaryContact && 'Primary contact', link.isFinanciallyResponsible && 'Financial contact', link.canPickUp && 'Can pick up'].filter(Boolean).join(' · ') || 'Linked guardian'}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </>}
  </>
}

export function ParentEditPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { parentId } = useParams()
  const { user, selectedSchoolId } = useOutletContext()
  const canEdit = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(user?.role)
  const parentQuery = useTenantQuery(`parent-profile:${parentId}`, () => parentApi.getById(parentId), Boolean(parentId))
  const parent = parentQuery.data?.data
  const update = useMutation({
    mutationFn: (body) => parentApi.update(parentId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant', selectedSchoolId] })
      navigate(`/workspace/parents/${parentId}`)
    },
  })

  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    update.mutate(values)
  }

  return <>
    <PageHeading eyebrow="Family profile" title={`Edit ${parent ? `${parent.firstName} ${parent.lastName}` : 'parent'}`} description="Update parent contact information. Linked students remain unchanged." action={<Button type="button" variant="secondary" onClick={() => navigate(`/workspace/parents/${parentId}`)}>Cancel</Button>} />
    {parentQuery.isPending && <p className={muted}>Loading parent profile...</p>}
    {parentQuery.isError && <Notice>{parentQuery.error.message}</Notice>}
    {update.isError && <Notice>{update.error.message}</Notice>}
    {parent && (canEdit ? <form key={parent.id} onSubmit={submit} className="max-w-5xl rounded-md border border-[#d7dfd8] bg-white p-5 shadow-[0_2px_8px_rgba(24,61,53,0.035)] sm:p-6">
      <p className="mb-5 text-xs text-[#63746a]">Parent ID and school ownership are system-managed. Empty optional contact fields will be cleared.</p>
      <div className="mb-6 rounded-md bg-[#f6f8f4] p-4"><ProfilePhoto relatedType="PARENT_PROFILE_PHOTO" relatedId={parent.id} name={`${parent.firstName} ${parent.middleName || ''} ${parent.lastName}`} canView={canEdit} canManage={canEdit} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <TextInput label="First name" name="firstName" required defaultValue={parent.firstName} />
        <TextInput label="Middle name" name="middleName" defaultValue={parent.middleName || ''} />
        <TextInput label="Last name" name="lastName" required defaultValue={parent.lastName} />
        <TextInput label="Phone" name="phone" type="tel" required defaultValue={parent.phone} />
        <TextInput label="Email" name="email" type="email" defaultValue={parent.email || ''} />
        <TextInput label="National ID" name="nationalIdNumber" required defaultValue={parent.nationalIdNumber} />
        <SelectInput label="Relationship" name="relation" required defaultValue={parent.relation} options={['MOTHER', 'FATHER', 'GUARDIAN'].map((value) => ({ value, label: value[0] + value.slice(1).toLowerCase() }))} />
      </div>
      <div className="mt-6 flex justify-end"><Button type="submit" isPending={update.isPending} icon={<Save className="h-4 w-4" aria-hidden="true" />}>Save changes</Button></div>
    </form> : <Notice>You do not have permission to edit parent profiles.</Notice>)}
  </>
}

export function AcademicsPage() {
  const schoolId = useTenantId()
  const queryClient = useQueryClient()
  const [section, setSection] = useState('years')
  const [notice, setNotice] = useState(null)
  const years = useTenantQuery('academic-years', () => academicsApi.listYears({ pageSize: 100 }))
  const classes = useTenantQuery('class-levels', () => academicsApi.listClasses({ pageSize: 200 }))
  const subjects = useTenantQuery('subjects', () => academicsApi.listSubjects({ pageSize: 200 }))
  const create = useMutation({
    mutationFn: ({ kind, body }) => ({
      year: academicsApi.createYear,
      term: academicsApi.createTerm,
      class: academicsApi.createClass,
      stream: academicsApi.createStream,
      subject: academicsApi.createSubject,
    }[kind])(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant', schoolId] })
      setNotice('Academic record saved.')
    },
  })
  const yearRows = years.data?.data?.items || []
  const classRows = classes.data?.data?.items || []
  const subjectRows = subjects.data?.data?.items || []
  const tabs = [['years', 'Years & terms'], ['classes', 'Classes & streams'], ['subjects', 'Subjects']]

  function submit(event, kind) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    let body = values
    if (kind === 'year') body = { ...values, isCurrent: form.elements.isCurrent.checked }
    create.mutate({ kind, body })
  }

  if (!schoolId) return <EmptySelection />
  return <>
    <PageHeading eyebrow="Teaching & learning" title="Academic setup" description="Configure academic years, terms, class levels, streams, and subjects." />
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#dce2d8]">{tabs.map(([value, label]) => <button type="button" key={value} onClick={() => { setSection(value); setNotice(null) }} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${section === value ? 'border-[#b34d3d] text-[#183d35]' : 'border-transparent text-[#718077] hover:text-[#304139]'}`}>{label}</button>)}</div>
    {notice && <Notice tone="success">{notice}</Notice>}{create.isError && <Notice>{create.error.message}</Notice>}
    {section === 'years' && <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]"><section><SectionTitle title="Academic years" detail="Terms are shown within their academic year." /><TableFrame headers={['Year', 'Start', 'End', 'Current', 'Terms']} empty="No academic years configured." isLoading={years.isPending}>{yearRows.map((year) => <tr key={year.id}><TableCell className="font-semibold">{year.name}</TableCell><TableCell>{String(year.startDate).slice(0, 10)}</TableCell><TableCell>{String(year.endDate).slice(0, 10)}</TableCell><TableCell>{year.isCurrent ? 'Yes' : 'No'}</TableCell><TableCell>{year.terms?.map((term) => term.name).join(', ') || '—'}</TableCell></tr>)}</TableFrame></section><div className="space-y-7"><form onSubmit={(event) => submit(event, 'year')} className="border-t border-[#dce2d8] pt-4"><SectionTitle title="Add academic year" /><div className="space-y-3"><TextInput label="Year name" name="name" placeholder="2026/2027" required /><TextInput label="Start date" name="startDate" type="date" required /><TextInput label="End date" name="endDate" type="date" required /><label className="flex items-center gap-2 text-sm text-[#34463b]"><input type="checkbox" name="isCurrent" className="accent-[#183d35]" />Set as current year</label><Button type="submit" isPending={create.isPending}>Save year</Button></div></form><form onSubmit={(event) => submit(event, 'term')} className="border-t border-[#dce2d8] pt-4"><SectionTitle title="Add term" /><div className="space-y-3"><SelectInput label="Academic year" name="academicYearId" required options={yearRows.map((year) => ({ value: year.id, label: year.name }))} /><SelectInput label="Term" name="name" required options={[1, 2, 3].map((number) => ({ value: `Term ${number}`, label: `Term ${number}` }))} /><TextInput label="Start date" name="startDate" type="date" required /><TextInput label="End date" name="endDate" type="date" required /><Button type="submit" isPending={create.isPending} disabled={!yearRows.length}>Save term</Button></div></form></div></div>}
    {section === 'classes' && <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]"><section><SectionTitle title="Class levels & streams" detail="Streams determine class placements for admissions and attendance." /><TableFrame headers={['Class level', 'Curriculum', 'Streams']} empty="No class levels configured." isLoading={classes.isPending}>{classRows.map((level) => <tr key={level.id}><TableCell className="font-semibold">{level.name}</TableCell><TableCell>{level.curriculum}</TableCell><TableCell>{level.streams?.map((stream) => stream.name).join(', ') || '—'}</TableCell></tr>)}</TableFrame></section><div className="space-y-7"><form onSubmit={(event) => submit(event, 'class')} className="border-t border-[#dce2d8] pt-4"><SectionTitle title="Add class level" /><div className="space-y-3"><TextInput label="Name" name="name" required /><SelectInput label="Curriculum" name="curriculum" required options={['CBC', 'KCSE', 'CAMBRIDGE', 'IB'].map((value) => ({ value, label: value }))} /><Button type="submit" isPending={create.isPending}>Save class</Button></div></form><form onSubmit={(event) => submit(event, 'stream')} className="border-t border-[#dce2d8] pt-4"><SectionTitle title="Add stream" /><div className="space-y-3"><SelectInput label="Class level" name="classLevelId" required options={classRows.map((level) => ({ value: level.id, label: level.name }))} /><TextInput label="Stream name" name="name" required placeholder="North" /><Button type="submit" isPending={create.isPending} disabled={!classRows.length}>Save stream</Button></div></form></div></div>}
    {section === 'subjects' && <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]"><section><SectionTitle title="Subjects" /><TableFrame headers={['Subject', 'Code', 'Curriculum']} empty="No subjects configured." isLoading={subjects.isPending}>{subjectRows.map((subject) => <tr key={subject.id}><TableCell className="font-semibold">{subject.name}</TableCell><TableCell>{subject.code}</TableCell><TableCell>{subject.curriculum}</TableCell></tr>)}</TableFrame></section><form onSubmit={(event) => submit(event, 'subject')} className="border-t border-[#dce2d8] pt-4"><SectionTitle title="Add subject" /><div className="space-y-3"><TextInput label="Name" name="name" required /><TextInput label="Code" name="code" required placeholder="ENG" /><SelectInput label="Curriculum" name="curriculum" required options={['CBC', 'KCSE', 'CAMBRIDGE', 'IB'].map((value) => ({ value, label: value }))} /><Button type="submit" isPending={create.isPending}>Save subject</Button></div></form></div>}
  </>
}