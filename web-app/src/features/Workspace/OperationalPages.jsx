import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import {
  academicsApi,
  attendanceApi,
  examApi,
  financeApi,
  hrApi,
  jobsApi,
  payrollApi,
  studentApi,
  userApi,
} from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'

const controlClass = 'w-full rounded-md border border-[#cbd6ce] bg-white px-3.5 py-3 text-sm text-[#17211b] shadow-sm outline-none transition placeholder:text-[#8b998e] focus:border-[#183d35] focus:ring-4 focus:ring-[#d3e77a]/25'
const muted = 'text-sm leading-6 text-[#63746a]'
const today = () => new Date().toISOString().slice(0, 10)

function useTenantQuery(name, queryFn, enabled = true) {
  const { selectedSchoolId } = useOutletContext()
  return useQuery({
    queryKey: ['tenant', selectedSchoolId, name],
    queryFn,
    enabled: Boolean(selectedSchoolId) && enabled,
  })
}

function Heading({ eyebrow, title, description }) {
  return <div className="mb-8 border-b border-[#d7dfd8] pb-7">
    <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b34d3d]">{eyebrow}</p>
    <h1 className="font-serif text-4xl leading-tight text-[#183d35]">{title}</h1>
    {description && <p className="mt-2.5 max-w-2xl text-sm leading-6 text-[#63746a]">{description}</p>}
  </div>
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-[#40564a]">{label}</span>{children}</label>
}

function TextField({ label, name, type = 'text', required = false, placeholder, defaultValue }) {
  return <Field label={label}><input className={controlClass} name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} /></Field>
}

function SelectField({ label, name, options, required = false, placeholder = 'Select an option' }) {
  return <Field label={label}><select className={controlClass} name={name} required={required} defaultValue=""><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
}

function Notice({ children, tone = 'error' }) {
  const style = tone === 'success'
    ? 'border-[#bfd08e] bg-[#f2f7e4] text-[#3c5830]'
    : 'border-[#e9b5a9] bg-[#fff4f0] text-[#8f3a2e]'
  return <div role="status" className={`mb-5 rounded-md border px-4 py-3.5 text-sm leading-5 ${style}`}>{children}</div>
}

function Panel({ title, description, children }) {
  return <section className="rounded-md border border-[#d7dfd8] bg-white px-5 py-6 shadow-[0_2px_8px_rgba(24,61,53,0.035)] sm:px-6">
    <div className="mb-6"><h2 className="text-base font-bold text-[#263b31]">{title}</h2>{description && <p className="mt-1.5 text-xs leading-5 text-[#63746a]">{description}</p>}</div>
    {children}
  </section>
}

function EmptySelection() {
  return <div className="grid min-h-72 place-items-center rounded-md border border-dashed border-[#bdcbbf] bg-white px-6 text-center"><div><p className="font-serif text-2xl text-[#183d35]">Select a school</p><p className="mt-2 text-sm text-[#63746a]">Choose an active school from the header to open its operations.</p></div></div>
}

function selectedEnrollment(student, streamId) {
  return student.enrollments?.find((enrollment) => enrollment.status === 'ACTIVE' && (!streamId || enrollment.stream?.id === streamId))
}

export function AttendancePage() {
  const { selectedSchoolId } = useOutletContext()
  const queryClient = useQueryClient()
  const [streamId, setStreamId] = useState('')
  const [date, setDate] = useState(today)
  const [statusEdits, setStatusEdits] = useState({})
  const [notice, setNotice] = useState('')
  const classes = useTenantQuery('attendance-classes', () => academicsApi.listClasses({ pageSize: 200 }))
  const streams = (classes.data?.data?.items || []).flatMap((level) => (level.streams || []).map((stream) => ({ ...stream, levelName: level.name })))
  const students = useTenantQuery(`attendance-students:${streamId}`, () => studentApi.list({ streamId, pageSize: 100 }), Boolean(streamId))
  const register = useTenantQuery(`attendance-register:${streamId}:${date}`, () => attendanceApi.getRegister({ streamId, date }), Boolean(streamId && date))
  const rows = (students.data?.data || []).filter((student) => selectedEnrollment(student, streamId))
  const recorded = register.data?.data || []
  const mark = useMutation({
    mutationFn: attendanceApi.mark,
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ['tenant', selectedSchoolId] })
      setNotice(`Attendance saved for ${data?.length ?? rows.length} learners.`)
    },
  })

  const existingStatuses = new Map(recorded.map((entry) => [entry.studentId, entry.status]))

  function submit(event) {
    event.preventDefault()
    const attendances = rows.map((student) => ({
      studentId: student.id,
      enrollmentId: selectedEnrollment(student, streamId).id,
      status: statusEdits[student.id] || existingStatuses.get(student.id) || 'PRESENT',
    }))
    mark.mutate({ date, streamId, attendances })
  }

  if (!selectedSchoolId) return <EmptySelection />
  return <>
    <Heading eyebrow="Daily operations" title="Attendance" description="Review a stream’s daily register and save attendance statuses for its active learners." />
    <div className="mb-6 grid gap-4 sm:grid-cols-[minmax(220px,1fr)_200px]">
      <Field label="Class and stream"><select className={controlClass} value={streamId} onChange={(event) => { setStreamId(event.target.value); setStatusEdits({}); setNotice('') }}><option value="">Select a stream</option>{streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.levelName} · {stream.name}</option>)}</select></Field>
      <Field label="Attendance date"><input className={controlClass} type="date" value={date} onChange={(event) => { setDate(event.target.value); setStatusEdits({}) }} /></Field>
    </div>
    {classes.isError && <Notice>{classes.error.message}</Notice>}
    {students.isError && <Notice>{students.error.message}</Notice>}
    {register.isError && <Notice>{register.error.message}</Notice>}
    {mark.isError && <Notice>{mark.error.message}</Notice>}
    {notice && <Notice tone="success">{notice}</Notice>}
    {!streamId ? <p className={muted}>Choose a class stream to load its register.</p> : <form onSubmit={submit}>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-[#263b31]">Learner register</h2><p className="mt-1 text-xs text-[#718077]">Existing marks for this date are preselected.</p></div><Button type="submit" isPending={mark.isPending} disabled={!rows.length}>Save register</Button></div>
      <div className="overflow-x-auto border-y border-[#dce2d8]"><table className="w-full min-w-[540px] text-left text-sm"><thead><tr className="border-b border-[#dce2d8] bg-[#f8faf7]"><th className="px-4 py-3 text-xs font-bold uppercase text-[#718077]">Admission no.</th><th className="px-4 py-3 text-xs font-bold uppercase text-[#718077]">Learner</th><th className="w-48 px-4 py-3 text-xs font-bold uppercase text-[#718077]">Status</th></tr></thead><tbody className="divide-y divide-[#e9eee7]">{students.isPending ? <tr><td colSpan="3" className="px-4 py-8 text-center text-[#718077]">Loading register...</td></tr> : rows.map((student) => <tr key={student.id}><td className="px-4 py-3.5 font-semibold text-[#34463b]">{student.admissionNo}</td><td className="px-4 py-3.5 text-[#34463b]">{student.firstName} {student.lastName}</td><td className="px-4 py-2"><select aria-label={`Attendance for ${student.firstName} ${student.lastName}`} className={controlClass} value={statusEdits[student.id] || existingStatuses.get(student.id) || 'PRESENT'} onChange={(event) => setStatusEdits((current) => ({ ...current, [student.id]: event.target.value }))}>{['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => <option key={status} value={status}>{status[0] + status.slice(1).toLowerCase()}</option>)}</select></td></tr>)}</tbody></table></div>
      {!students.isPending && !rows.length && <p className="py-8 text-center text-sm text-[#718077]">No active enrollments are available for this stream.</p>}
    </form>}
  </>
}

export function ExamsPage() {
  const { selectedSchoolId } = useOutletContext()
  const queryClient = useQueryClient()
  const [createdExam, setCreatedExam] = useState(null)
  const [examId, setExamId] = useState('')
  const [notice, setNotice] = useState('')
  const years = useTenantQuery('exam-years', () => academicsApi.listYears({ pageSize: 100 }))
  const subjects = useTenantQuery('exam-subjects', () => academicsApi.listSubjects({ pageSize: 200 }))
  const students = useTenantQuery('exam-students', () => studentApi.list({ pageSize: 100 }))
  const terms = (years.data?.data?.items || []).flatMap((year) => (year.terms || []).map((term) => ({ ...term, yearName: year.name })))
  const subjectRows = subjects.data?.data?.items || []
  const studentRows = (students.data?.data || []).filter((student) => selectedEnrollment(student))
  const create = useMutation({
    mutationFn: examApi.create,
    onSuccess: async ({ data }) => {
      setCreatedExam(data)
      setExamId(data.id)
      setNotice('Exam schedule created.')
      await queryClient.invalidateQueries({ queryKey: ['tenant', selectedSchoolId, 'exam'] })
    },
  })
  const record = useMutation({
    mutationFn: ({ id, body }) => examApi.recordResults(id, body),
    onSuccess: ({ data }) => setNotice(`Saved ${data?.length ?? 1} exam result.`),
  })

  function createExam(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    create.mutate({ ...values, maxScore: Number(values.maxScore) })
  }

  function saveResult(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const student = studentRows.find((row) => row.id === values.studentId)
    const enrollment = selectedEnrollment(student)
    record.mutate({
      id: examId,
      body: { results: [{ studentId: student.id, enrollmentId: enrollment.id, score: Number(values.score), ...(values.grade ? { grade: values.grade } : {}), ...(values.remarks ? { remarks: values.remarks } : {}) }] },
    })
  }

  if (!selectedSchoolId) return <EmptySelection />
  return <>
    <Heading eyebrow="Assessment" title="Exams & results" description="Schedule an exam and record learner results. The API currently exposes create and result-entry actions, not an exam list." />
    {notice && <Notice tone="success">{notice}</Notice>}{create.isError && <Notice>{create.error.message}</Notice>}{record.isError && <Notice>{record.error.message}</Notice>}
    <div className="grid gap-8 xl:grid-cols-2">
      <Panel title="Schedule exam" description="Choose a term and subject configured for this school.">
        <form className="space-y-4" onSubmit={createExam}>
          <TextField label="Exam name" name="name" required placeholder="End of term assessment" />
          <SelectField label="Term" name="termId" required options={terms.map((term) => ({ value: term.id, label: `${term.yearName} · ${term.name}` }))} />
          <SelectField label="Subject" name="subjectId" required options={subjectRows.map((subject) => ({ value: subject.id, label: `${subject.name} (${subject.code})` }))} />
          <div className="grid gap-4 sm:grid-cols-2"><TextField label="Exam date" name="examDate" type="date" required /><TextField label="Maximum score" name="maxScore" type="number" defaultValue="100" required /></div>
          <Button type="submit" isPending={create.isPending} disabled={!terms.length || !subjectRows.length}>Schedule exam</Button>
        </form>
        {createdExam && <div className="mt-5 border-l-4 border-[#9ab545] bg-[#f4f8e8] px-4 py-3 text-sm text-[#3c5830]"><p className="font-bold">{createdExam.name}</p><p className="mt-1 break-all text-xs">Exam ID: {createdExam.id}</p></div>}
      </Panel>
      <Panel title="Record a result" description="Results are checked against the exam year and the learner’s active enrollment.">
        <form className="space-y-4" onSubmit={saveResult}>
          <Field label="Exam ID"><input className={controlClass} value={examId} onChange={(event) => setExamId(event.target.value)} required placeholder="Create an exam or enter its ID" /></Field>
          <SelectField label="Learner" name="studentId" required options={studentRows.map((student) => ({ value: student.id, label: `${student.admissionNo} · ${student.firstName} ${student.lastName}` }))} />
          <div className="grid gap-4 sm:grid-cols-2"><TextField label="Score" name="score" type="number" min="0" step="0.01" required /><TextField label="Grade" name="grade" placeholder="A" /></div>
          <TextField label="Remarks" name="remarks" />
          <Button type="submit" isPending={record.isPending} disabled={!examId || !studentRows.length}>Save result</Button>
        </form>
        {!studentRows.length && <p className="mt-4 text-xs text-[#9b3d30]">Students need an active enrollment before results can be recorded.</p>}
      </Panel>
    </div>
  </>
}

export function FinancePage() {
  const { selectedSchoolId } = useOutletContext()
  const queryClient = useQueryClient()
  const [invoiceBatch, setInvoiceBatch] = useState(null)
  const [paymentResult, setPaymentResult] = useState(null)
  const [notice, setNotice] = useState('')
  const [selectedReminder, setSelectedReminder] = useState(null)
  const [singleProvider, setSingleProvider] = useState('')
  const [singleRecipient, setSingleRecipient] = useState('')
  const [singleSubject, setSingleSubject] = useState('')
  const [singleMessage, setSingleMessage] = useState('')
  const [bulkProvider, setBulkProvider] = useState('')
  const [bulkSubject, setBulkSubject] = useState('')
  const [bulkNote, setBulkNote] = useState('')
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [activeReminderBatchId, setActiveReminderBatchId] = useState('')
  const years = useTenantQuery('finance-years', () => academicsApi.listYears({ pageSize: 100 }))
  const classes = useTenantQuery('finance-classes', () => academicsApi.listClasses({ pageSize: 200 }))
  const students = useTenantQuery('finance-students', () => studentApi.list({ pageSize: 100 }))
  const providersQuery = useTenantQuery('reminder-providers', financeApi.reminderProviders)
  const overdueQuery = useTenantQuery('overdue-invoices', financeApi.listOverdueInvoices)
  const terms = (years.data?.data?.items || []).flatMap((year) => (year.terms || []).map((term) => ({ ...term, yearName: year.name })))
  const classRows = classes.data?.data?.items || []
  const studentRows = students.data?.data || []
  const providers = providersQuery.data?.data || []
  const connectedProviders = providers.filter((provider) => provider.connected)
  const overdueData = overdueQuery.data?.data
  const overdueInvoices = overdueData?.items || []
  const invoices = useMutation({
    mutationFn: financeApi.generateInvoices,
    onSuccess: async ({ data }) => {
      setInvoiceBatch(data)
      setNotice(`Invoice generation completed: ${data.totalGenerated} invoices.`)
      await queryClient.invalidateQueries({ queryKey: ['tenant', selectedSchoolId] })
    },
  })
  const payment = useMutation({
    mutationFn: financeApi.recordPayment,
    onSuccess: ({ data }) => {
      setPaymentResult(data)
      setNotice('Payment recorded.')
    },
  })
  const sendSingleReminder = useMutation({
    mutationFn: ({ invoiceId, body }) => financeApi.sendInvoiceReminder(invoiceId, body),
    onSuccess: async ({ data }) => {
      setActiveReminderBatchId(data.batchId)
      setSelectedReminder(null)
      setNotice('Reminder queued. Delivery status will update below.')
      await queryClient.invalidateQueries({ queryKey: ['tenant', selectedSchoolId, 'overdue-invoices'] })
    },
  })
  const sendBulkReminders = useMutation({
    mutationFn: financeApi.sendBulkReminders,
    onSuccess: async ({ data }) => {
      setActiveReminderBatchId(data.batchId)
      setIsBulkDialogOpen(false)
      setNotice('Bulk reminders queued. Delivery status will update below.')
      await queryClient.invalidateQueries({ queryKey: ['tenant', selectedSchoolId, 'overdue-invoices'] })
    },
  })
  const reminderBatch = useQuery({
    queryKey: ['tenant', selectedSchoolId, 'reminder-batch', activeReminderBatchId],
    queryFn: () => financeApi.getReminderBatch(activeReminderBatchId),
    enabled: Boolean(selectedSchoolId && activeReminderBatchId),
    refetchInterval: (query) => (query.state.data?.data?.progress ?? 0) < 100 ? 1000 : false,
  })
  const reminderBatchData = reminderBatch.data?.data

  function submitInvoices(event) {
    event.preventDefault()
    invoices.mutate(Object.fromEntries(new FormData(event.currentTarget)))
  }

  function submitPayment(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const amount = Number(values.amount)
    const body = {
      studentId: values.studentId,
      amount,
      method: values.method,
      reference: values.reference || undefined,
      idempotencyKey: values.idempotencyKey || globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...(values.invoiceId ? { allocations: [{ invoiceId: values.invoiceId, amount }] } : {}),
    }
    payment.mutate(body)
  }

  function openSingleReminder(invoice) {
    const recipient = invoice.recipients[0]
    const parentName = recipient?.name || 'Parent/Guardian'
    setSelectedReminder(invoice)
    setSingleProvider(connectedProviders[0]?.provider || '')
    setSingleRecipient(recipient?.email || '')
    setSingleSubject(`Fee reminder for ${invoice.studentName}`)
    setSingleMessage([
      `Hello ${parentName},`,
      '',
      `Our records show an outstanding school fee balance for ${invoice.studentName} (${invoice.admissionNo}).`,
      `Term: ${invoice.term} ${invoice.academicYear}`,
      `Outstanding balance: KES ${invoice.outstanding}`,
      `Due date: ${invoice.dueDate}`,
      `Invoice reference: ${invoice.id}`,
      '',
      'Please contact the school finance office if you have already made this payment or need assistance.',
    ].join('\n'))
  }

  function submitSingleReminder(event) {
    event.preventDefault()
    if (!selectedReminder) return
    sendSingleReminder.mutate({
      invoiceId: selectedReminder.id,
      body: {
        provider: singleProvider,
        recipientEmail: singleRecipient,
        subject: singleSubject,
        message: singleMessage,
      },
    })
  }

  function openBulkDialog() {
    setBulkProvider(connectedProviders[0]?.provider || '')
    setBulkSubject('School fee payment reminder')
    setBulkNote('')
    setIsBulkDialogOpen(true)
  }

  function submitBulkReminders(event) {
    event.preventDefault()
    sendBulkReminders.mutate({
      provider: bulkProvider,
      ...(bulkSubject.trim() ? { subject: bulkSubject.trim() } : {}),
      ...(bulkNote.trim() ? { note: bulkNote.trim() } : {}),
    })
  }

  if (!selectedSchoolId) return <EmptySelection />
  return <>
    <Heading eyebrow="Finance" title="Fees & payments" description="Manage invoices and payment activity, and send tracked fee reminders to families with overdue balances." />
    {notice && <Notice tone="success">{notice}</Notice>}{invoices.isError && <Notice>{invoices.error.message}</Notice>}{payment.isError && <Notice>{payment.error.message}</Notice>}{sendSingleReminder.isError && <Notice>{sendSingleReminder.error.message}</Notice>}{sendBulkReminders.isError && <Notice>{sendBulkReminders.error.message}</Notice>}
    <div className="grid gap-8 xl:grid-cols-2">
      <Panel title="Generate term invoices" description="Creates invoices for active enrollments in the selected class level.">
        <form className="space-y-4" onSubmit={submitInvoices}>
          <SelectField label="Term" name="termId" required options={terms.map((term) => ({ value: term.id, label: `${term.yearName} · ${term.name}` }))} />
          <SelectField label="Class level" name="classLevelId" required options={classRows.map((level) => ({ value: level.id, label: level.name }))} />
          <TextField label="Due date" name="dueDate" type="date" required />
          <Button type="submit" isPending={invoices.isPending} disabled={!terms.length || !classRows.length}>Generate invoices</Button>
        </form>
        {invoiceBatch && <div className="mt-5 border-l-4 border-[#9ab545] bg-[#f4f8e8] px-4 py-3 text-sm text-[#3c5830]"><p className="font-bold">{invoiceBatch.totalGenerated} invoices generated</p><details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Invoice IDs</summary><ul className="mt-2 max-h-28 overflow-auto">{invoiceBatch.invoiceIds?.map((id) => <li key={id} className="break-all py-0.5">{id}</li>)}</ul></details></div>}
      </Panel>
      <Panel title="Record payment" description="Without an invoice ID, the payment is saved for later allocation.">
        <form className="space-y-4" onSubmit={submitPayment}>
          <SelectField label="Learner" name="studentId" required options={studentRows.map((student) => ({ value: student.id, label: `${student.admissionNo} · ${student.firstName} ${student.lastName}` }))} />
          <div className="grid gap-4 sm:grid-cols-2"><TextField label="Amount" name="amount" type="number" min="0.01" step="0.01" required /><SelectField label="Method" name="method" required options={['MPESA', 'CASH', 'CHEQUE', 'BANK_DEPOSIT', 'BANK_TRANSFER', 'CARD'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))} /></div>
          <TextField label="Invoice ID (optional)" name="invoiceId" placeholder="Allocate this payment immediately" />
          <TextField label="Reference (optional)" name="reference" />
          <Button type="submit" isPending={payment.isPending} disabled={!studentRows.length}>Record payment</Button>
        </form>
        {paymentResult && <div className="mt-5 border-l-4 border-[#9ab545] bg-[#f4f8e8] px-4 py-3 text-sm text-[#3c5830]"><p className="font-bold">Payment saved</p><p className="mt-1 text-xs">ID: {paymentResult.id} · {paymentResult.requiresAllocation ? 'Awaiting allocation' : 'Allocated'}</p></div>}
      </Panel>
    </div>

    <section className="mt-10">
      <div className="mb-5 flex flex-col gap-4 border-b border-[#d7dfd8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b34d3d]">Receivables</p><h2 className="font-serif text-2xl text-[#183d35]">Overdue invoices</h2><p className="mt-1 text-sm text-[#63746a]">Review outstanding balances, preview recipients, and send individual or bulk reminders.</p></div>
        <Button type="button" onClick={openBulkDialog} disabled={!overdueInvoices.length || !connectedProviders.length || overdueQuery.isPending} isPending={sendBulkReminders.isPending}>Remind all overdue</Button>
      </div>
      {providersQuery.isError && <Notice>{providersQuery.error.message}</Notice>}
      {!providersQuery.isPending && !connectedProviders.length && <Notice>No reminder email provider is configured. Ask your administrator to configure Gmail or Outlook SMTP credentials on the server.</Notice>}
      {overdueQuery.isError && <Notice>{overdueQuery.error.message}</Notice>}
      {reminderBatch.isError && <Notice>{reminderBatch.error.message}</Notice>}
      {reminderBatchData && <section className="mb-5 rounded-md border border-[#d7dfd8] bg-white p-5 shadow-[0_2px_8px_rgba(24,61,53,0.035)]" aria-live="polite">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-[#263b31]">Reminder batch progress</h3><p className="mt-1 break-all text-xs text-[#718077]">Batch {reminderBatchData.batchId}</p></div><p className="text-sm font-bold text-[#183d35]">{reminderBatchData.progress}%</p></div>
        <div role="progressbar" aria-label="Reminder delivery progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={reminderBatchData.progress} className="h-2 overflow-hidden rounded-full bg-[#e9eee7]"><div className="h-full rounded-full bg-[#6d8e62] transition-all" style={{ width: `${reminderBatchData.progress}%` }} /></div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#63746a]"><span>{reminderBatchData.counts.SENT} sent</span><span>{reminderBatchData.counts.PENDING} pending</span><span>{reminderBatchData.counts.FAILED} failed</span><span>{reminderBatchData.counts.SKIPPED} skipped</span></div>
        {reminderBatchData.reminders.some((reminder) => reminder.status === 'FAILED' || reminder.status === 'SKIPPED') && <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-[#52675a]">Review failed or skipped reminders</summary><ul className="mt-2 space-y-1">{reminderBatchData.reminders.filter((reminder) => reminder.status === 'FAILED' || reminder.status === 'SKIPPED').map((reminder) => <li key={reminder.id} className="text-[#8f3a2e]">{reminder.recipientEmail || 'No email'}: {reminder.failureReason}</li>)}</ul></details>}
      </section>}
      {overdueData && <div className="mb-4 flex flex-wrap gap-3 text-xs font-semibold text-[#52675a]"><span className="rounded-md bg-white px-3 py-2">{overdueData.totalInvoices} overdue invoices</span><span className="rounded-md bg-white px-3 py-2">KES {overdueData.totalOutstanding} outstanding</span><span className="rounded-md bg-white px-3 py-2">{overdueData.recipientCount} parent email recipients</span></div>}
      <div className="overflow-x-auto rounded-md border border-[#d7dfd8] bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead><tr className="border-b border-[#d7dfd8] bg-[#f1f5f0]">{['Learner / invoice', 'Term', 'Due date', 'Balance', 'Recipients', 'Last reminder', 'Action'].map((label) => <th key={label} className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#63746a]">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#edf0eb] [&_tr]:transition-colors [&_tr:hover]:bg-[#f8faf7]">
            {overdueQuery.isPending ? <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-[#63746a]">Loading overdue invoices...</td></tr> : overdueInvoices.map((invoice) => {
              const latestReminder = invoice.reminderHistory[0]
              return <tr key={invoice.id}>
                <td className="px-4 py-3.5"><p className="font-semibold text-[#263b31]">{invoice.studentName}</p><p className="mt-0.5 text-xs text-[#718077]">{invoice.admissionNo} · {invoice.id.slice(0, 8)}</p></td>
                <td className="px-4 py-3.5 text-[#34463b]">{invoice.term} {invoice.academicYear}</td>
                <td className="px-4 py-3.5 text-[#34463b]">{invoice.dueDate}<span className="mt-0.5 block text-xs text-[#9b3d30]">{invoice.daysOverdue} days overdue</span></td>
                <td className="px-4 py-3.5 font-bold text-[#183d35]">KES {invoice.outstanding}</td>
                <td className="px-4 py-3.5 text-[#34463b]">{invoice.recipients.length ? invoice.recipients.map((recipient) => recipient.email).join(', ') : <span className="text-[#9b3d30]">No parent email</span>}</td>
                <td className="px-4 py-3.5">{latestReminder ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${latestReminder.status === 'SENT' ? 'bg-[#eef4dd] text-[#526d2d]' : latestReminder.status === 'FAILED' ? 'bg-[#fff0ed] text-[#9b3d30]' : 'bg-[#f1f3ef] text-[#63746a]'}`}>{latestReminder.status.toLowerCase()}</span> : <span className="text-xs text-[#718077]">Not sent</span>}</td>
                <td className="px-4 py-3.5"><button type="button" onClick={() => openSingleReminder(invoice)} disabled={!connectedProviders.length} className="whitespace-nowrap rounded-md border border-[#bfcdbf] px-3 py-2 text-xs font-bold text-[#315643] transition hover:bg-[#f2f6ee] disabled:cursor-not-allowed disabled:opacity-50">Send reminder</button></td>
              </tr>
            })}
          </tbody>
        </table>
        {!overdueQuery.isPending && !overdueInvoices.length && <p className="px-4 py-12 text-center text-sm text-[#63746a]">No overdue invoices for this school.</p>}
      </div>
      {overdueInvoices.some((invoice) => invoice.reminderHistory.length) && <details className="mt-4 rounded-md border border-[#d7dfd8] bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-bold text-[#40564a]">Recent reminder history</summary>
        <div className="mt-3 divide-y divide-[#edf0eb]">{overdueInvoices.flatMap((invoice) => invoice.reminderHistory.map((reminder) => <div key={reminder.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span className="text-[#34463b]">{invoice.studentName} · {reminder.recipientEmail || 'No email'} · {reminder.provider}</span><span className="font-semibold text-[#63746a]">{reminder.status} {reminder.sentAt ? `· ${new Date(reminder.sentAt).toLocaleString()}` : `· ${reminder.failureReason || ''}`}</span></div>))}</div>
      </details>}
    </section>

    {selectedReminder && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#14251f]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedReminder(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="single-reminder-title" className="my-auto w-full max-w-2xl rounded-md border border-[#d7dfd8] bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b34d3d]">Overdue invoice</p><h2 id="single-reminder-title" className="mt-1 font-serif text-2xl text-[#183d35]">Send a fee reminder</h2><p className="mt-1 text-sm text-[#63746a]">{selectedReminder.studentName} · KES {selectedReminder.outstanding}</p></div><button type="button" aria-label="Close reminder editor" onClick={() => setSelectedReminder(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#d7dfd8] text-[#63746a] hover:bg-[#f3f5f1]"><X className="h-4 w-4" /></button></div>
        <form className="space-y-4" onSubmit={submitSingleReminder}>
          <Field label="Email provider"><select required value={singleProvider} onChange={(event) => setSingleProvider(event.target.value)} className={controlClass}><option value="">Select a configured provider</option>{connectedProviders.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.provider === 'GMAIL' ? 'Gmail' : 'Outlook'}</option>)}</select></Field>
          <Field label="Recipient email"><input type="email" required value={singleRecipient} onChange={(event) => setSingleRecipient(event.target.value)} list="reminder-recipient-options" className={controlClass} /><datalist id="reminder-recipient-options">{selectedReminder.recipients.map((recipient) => <option key={recipient.email} value={recipient.email}>{recipient.name}</option>)}</datalist></Field>
          <Field label="Subject"><input required maxLength={200} value={singleSubject} onChange={(event) => setSingleSubject(event.target.value)} className={controlClass} /></Field>
          <Field label="Message preview"><textarea required maxLength={5000} rows={9} value={singleMessage} onChange={(event) => setSingleMessage(event.target.value)} className={`${controlClass} resize-y leading-6`} /></Field>
          {sendSingleReminder.isError && <Notice>{sendSingleReminder.error.message}</Notice>}
          <div className="flex justify-end gap-2"><Button type="button" variant="quiet" onClick={() => setSelectedReminder(null)}>Cancel</Button><Button type="submit" isPending={sendSingleReminder.isPending}>Queue reminder</Button></div>
        </form>
      </section>
    </div>}

    {isBulkDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#14251f]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsBulkDialogOpen(false) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="bulk-reminder-title" className="my-auto w-full max-w-2xl rounded-md border border-[#d7dfd8] bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b34d3d]">Bulk dispatch</p><h2 id="bulk-reminder-title" className="mt-1 font-serif text-2xl text-[#183d35]">Remind overdue families</h2></div><button type="button" aria-label="Close bulk reminder confirmation" onClick={() => setIsBulkDialogOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#d7dfd8] text-[#63746a] hover:bg-[#f3f5f1]"><X className="h-4 w-4" /></button></div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-md bg-[#f2f5f0] p-3"><p className="text-[10px] font-bold uppercase text-[#63746a]">Invoices</p><p className="mt-1 text-xl font-bold text-[#183d35]">{overdueData?.totalInvoices || 0}</p></div><div className="rounded-md bg-[#f2f5f0] p-3"><p className="text-[10px] font-bold uppercase text-[#63746a]">Outstanding</p><p className="mt-1 text-xl font-bold text-[#183d35]">KES {overdueData?.totalOutstanding || '0.00'}</p></div><div className="rounded-md bg-[#f2f5f0] p-3"><p className="text-[10px] font-bold uppercase text-[#63746a]">Recipients</p><p className="mt-1 text-xl font-bold text-[#183d35]">{overdueData?.recipientCount || 0}</p></div></div>
        <div className="mb-5 rounded-md border border-[#e5ebe5] px-4 py-3"><p className="mb-2 text-xs font-bold text-[#40564a]">Recipient preview</p><div className="max-h-28 overflow-y-auto text-xs text-[#63746a]">{overdueInvoices.flatMap((invoice) => invoice.recipients.map((recipient) => `${recipient.name || 'Parent/Guardian'} · ${recipient.email}`)).slice(0, 10).map((recipient) => <p key={recipient} className="py-0.5">{recipient}</p>)}{(overdueData?.recipientCount || 0) > 10 && <p className="pt-1 font-semibold">and {overdueData.recipientCount - 10} more recipients</p>}</div><p className="mt-2 text-xs text-[#8f3a2e]">{overdueInvoices.filter((invoice) => !invoice.recipients.length).length} invoices without parent email will be skipped.</p></div>
        <form className="space-y-4" onSubmit={submitBulkReminders}>
          <Field label="Email provider"><select required value={bulkProvider} onChange={(event) => setBulkProvider(event.target.value)} className={controlClass}><option value="">Select a configured provider</option>{connectedProviders.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.provider === 'GMAIL' ? 'Gmail' : 'Outlook'}</option>)}</select></Field>
          <Field label="Global subject"><input required maxLength={200} value={bulkSubject} onChange={(event) => setBulkSubject(event.target.value)} className={controlClass} /></Field>
          <Field label="Optional note for all recipients"><textarea value={bulkNote} onChange={(event) => setBulkNote(event.target.value)} rows={3} className={`${controlClass} resize-y leading-6`} placeholder="Add a school-wide note to each personalized reminder" /></Field>
          {sendBulkReminders.isError && <Notice>{sendBulkReminders.error.message}</Notice>}
          <div className="flex justify-end gap-2"><Button type="button" variant="quiet" onClick={() => setIsBulkDialogOpen(false)}>Cancel</Button><Button type="submit" isPending={sendBulkReminders.isPending} disabled={!overdueInvoices.length || !connectedProviders.length}>Queue all reminders</Button></div>
        </form>
      </section>
    </div>}
  </>
}

export function PayrollPage() {
  const { selectedSchoolId } = useOutletContext()
  const [jobId, setJobId] = useState('')
  const [notice, setNotice] = useState('')
  const run = useMutation({
    mutationFn: payrollApi.executeRun,
    onSuccess: ({ data }) => {
      setJobId(data.jobId)
      setNotice('Payroll run queued.')
    },
  })
  const job = useTenantQuery(`payroll-job:${jobId}`, () => jobsApi.get(jobId), Boolean(jobId))
  const jobDetails = job.data?.data
  const finished = Boolean(jobDetails?.completedAt) || ['COMPLETED', 'SUCCEEDED', 'FAILED', 'DEAD'].includes(jobDetails?.status)

  function submit(event) {
    event.preventDefault()
    run.mutate({ month: new FormData(event.currentTarget).get('month') })
  }

  if (!selectedSchoolId) return <EmptySelection />
  return <>
    <Heading eyebrow="People operations" title="Payroll" description="Queue a payroll run for this school. Processing continues in the background and its status is shown here." />
    {notice && <Notice tone="success">{notice}</Notice>}{run.isError && <Notice>{run.error.message}</Notice>}{job.isError && <Notice>{job.error.message}</Notice>}
    <div className="max-w-2xl">
      <Panel title="Execute payroll run" description="Choose the payroll month in YYYY-MM format.">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={submit}>
          <div className="w-full sm:max-w-xs"><TextField label="Payroll month" name="month" type="month" required /></div>
          <Button type="submit" isPending={run.isPending}>Queue payroll</Button>
        </form>
      </Panel>
      {jobId && <section className="mt-6 border border-[#dce2d8] bg-white p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#718077]">Payroll job</p><p className="mt-1 break-all text-sm font-semibold text-[#183d35]">{jobId}</p></div><span className="rounded-full bg-[#eef4dd] px-3 py-1 text-xs font-bold text-[#526d2d]">{jobDetails?.status || (job.isPending ? 'Loading' : 'Queued')}</span></div>{jobDetails?.error && <p className="mt-3 text-sm text-[#9b3d30]">{jobDetails.error}</p>}<p className="mt-3 text-xs text-[#718077]">{finished ? `Updated ${new Date(jobDetails.updatedAt).toLocaleString()}` : 'Status refreshes automatically while this job is running.'}</p></section>}
    </div>
  </>
}

export function StaffPage() {
  const { selectedSchoolId, user } = useOutletContext()
  const [staffKind, setStaffKind] = useState('teacher')
  const [provisioned, setProvisioned] = useState(null)
  const [leaveResult, setLeaveResult] = useState(null)
  const [notice, setNotice] = useState('')
  const isAdmin = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(user?.role)
  const provision = useMutation({
    mutationFn: ({ kind, body }) => kind === 'teacher' ? userApi.createTeacher(body) : userApi.createStaff(body),
    onSuccess: ({ data }) => {
      setProvisioned(data)
      setNotice(`${staffKind === 'teacher' ? 'Teacher' : 'Staff'} account created and credentials sent.`)
    },
  })
  const requestLeave = useMutation({
    mutationFn: hrApi.requestLeave,
    onSuccess: ({ data }) => {
      setLeaveResult(data)
      setNotice('Leave request submitted.')
    },
  })
  const approve = useMutation({
    mutationFn: hrApi.approveLeave,
    onSuccess: ({ data }) => {
      setLeaveResult(data)
      setNotice('Leave request approved.')
    },
  })

  function submitProvision(event) {
    event.preventDefault()
    const values = Object.fromEntries(
      [...new FormData(event.currentTarget)].filter(([, value]) => value !== ''),
    )
    provision.mutate({ kind: staffKind, body: values })
  }

  function submitLeave(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    requestLeave.mutate({
      leaveTypeId: values.leaveTypeId,
      startDate: values.startDate,
      endDate: values.endDate,
      ...(values.reason ? { reason: values.reason } : {}),
      [values.employeeType === 'teacher' ? 'teacherId' : 'staffId']: values.employeeId,
    })
  }

  function submitApproval(event) {
    event.preventDefault()
    approve.mutate(new FormData(event.currentTarget).get('leaveRequestId'))
  }

  if (!selectedSchoolId) return <EmptySelection />
  return <>
    <Heading eyebrow="People operations" title="Staff & leave" description="Provision employee accounts and submit or approve leave using the employee and leave-type IDs from your school records." />
    {notice && <Notice tone="success">{notice}</Notice>}{provision.isError && <Notice>{provision.error.message}</Notice>}{requestLeave.isError && <Notice>{requestLeave.error.message}</Notice>}{approve.isError && <Notice>{approve.error.message}</Notice>}
    <div className="grid gap-8 xl:grid-cols-2">
      {isAdmin && <Panel title="Provision employee" description="New staff receive temporary credentials by email and must change their password.">
        <div className="mb-5 flex gap-2" role="group" aria-label="Employee type">
          {['teacher', 'staff'].map((kind) => <button key={kind} type="button" aria-pressed={staffKind === kind} onClick={() => setStaffKind(kind)} className={`rounded-lg px-3 py-2 text-sm font-bold ${staffKind === kind ? 'bg-[#183d35] text-white' : 'bg-[#eef1eb] text-[#56665c]'}`}>{kind === 'teacher' ? 'Teacher' : 'Staff'}</button>)}
        </div>
        <form onSubmit={submitProvision} className="grid gap-4 sm:grid-cols-2">
          <TextField label="Username" name="username" required /><TextField label="Email" name="email" type="email" required />
          <TextField label="Phone" name="phone" type="tel" required /><TextField label="First name" name="firstName" required />
          <TextField label="Middle name" name="middleName" /><TextField label="Last name" name="lastName" required />
          <TextField label="National ID" name="nationalIdNumber" required /><TextField label="Passport number (leave empty when using ID)" name="passportNumber" />
          <TextField label="NSSF number" name="nssfNumber" required /><TextField label="KRA PIN" name="kraPin" required />
          <TextField label="SHA number" name="shaNumber" required /><TextField label="Hire date" name="hireDate" type="date" required />
          {staffKind === 'staff' && <><TextField label="Department" name="department" required /><TextField label="Job title" name="jobTitle" required /></>}
          <div className="sm:col-span-2"><Button type="submit" isPending={provision.isPending}>Create {staffKind}</Button></div>
        </form>
        {provisioned && <div className="mt-5 break-all border-l-4 border-[#9ab545] bg-[#f4f8e8] px-4 py-3 text-sm text-[#3c5830]"><p className="font-bold">Profile created</p><p className="mt-1 text-xs">Profile ID: {provisioned.id}</p><p className="text-xs">Employee number: {provisioned.employeeNo}</p></div>}
      </Panel>}
      <div className="space-y-8">
        <Panel title="Request leave" description="The backend currently requires employee and leave-type IDs; it does not yet expose lookup lists.">
          <form onSubmit={submitLeave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2"><SelectField label="Employee type" name="employeeType" required options={[{ value: 'teacher', label: 'Teacher' }, { value: 'staff', label: 'Staff' }]} /><TextField label="Employee profile ID" name="employeeId" required /></div>
            <TextField label="Leave type ID" name="leaveTypeId" required />
            <div className="grid gap-4 sm:grid-cols-2"><TextField label="Start date" name="startDate" type="date" required /><TextField label="End date" name="endDate" type="date" required /></div>
            <TextField label="Reason" name="reason" />
            <Button type="submit" isPending={requestLeave.isPending}>Submit leave request</Button>
          </form>
          {leaveResult && <p className="mt-4 break-all text-xs text-[#718077]">Request ID: {leaveResult.id} · Status: {leaveResult.status}</p>}
        </Panel>
        {isAdmin && <Panel title="Approve leave" description="Approval also checks the configured leave balance.">
          <form onSubmit={submitApproval} className="flex flex-col gap-4 sm:flex-row sm:items-end"><div className="w-full"><TextField label="Leave request ID" name="leaveRequestId" required /></div><Button type="submit" isPending={approve.isPending}>Approve request</Button></form>
        </Panel>}
      </div>
    </div>
  </>
}