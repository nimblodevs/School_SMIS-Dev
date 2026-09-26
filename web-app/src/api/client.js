import axios from 'axios'

const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '')
const selectedSchoolStorageKey = 'school-smis:selected-school'

export class ApiError extends Error {
    constructor(message, status, code, details) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.code = code
        this.details = details
    }
}

export const apiClient = axios.create({
    baseURL: apiBaseUrl,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
})

export function getSelectedSchoolId() {
    try {
        return globalThis.localStorage?.getItem(selectedSchoolStorageKey) || ''
    } catch {
        return ''
    }
}

export function setSelectedSchoolId(schoolId) {
    try {
        if (schoolId) globalThis.localStorage?.setItem(selectedSchoolStorageKey, schoolId)
        else globalThis.localStorage?.removeItem(selectedSchoolStorageKey)
    } catch {
        return
    }
}

apiClient.interceptors.request.use((config) => {
    const selectedSchoolId = getSelectedSchoolId()
    const explicitSchoolId =
        config.headers?.['x-school-id'] ?? config.headers?.get?.('x-school-id')
    if (selectedSchoolId && !explicitSchoolId) {
        config.headers = config.headers || {}
        config.headers['x-school-id'] = selectedSchoolId
    }
    return config
})

let refreshPromise = null

const authPathsWithoutRefresh = [
    '/auth/login',
    '/auth/verify-login-otp',
    '/auth/resend-login-otp',
    '/auth/forgot-password',
    '/auth/verify-otp',
    '/auth/reset-password',
    '/auth/change-password',
    '/auth/refresh',
]

function isAuthPath(url = '') {
    return authPathsWithoutRefresh.some((path) => url.includes(path))
}

function toApiError(error) {
    if (error instanceof ApiError) return error
    const payload = error.response?.data || {}
    return new ApiError(
        payload.error?.message || payload.message || 'Something went wrong. Please try again.',
        error.response?.status,
        payload.error?.code,
        payload.error?.details,
    )
}

apiClient.interceptors.response.use(
    (response) => {
        if (response.data?.success === false) {
            const payload = response.data
            throw new ApiError(
                payload.error?.message || payload.message || 'Something went wrong. Please try again.',
                response.status,
                payload.error?.code,
                payload.error?.details,
            )
        }
        return response.data
    },
    async (error) => {
        const originalRequest = error.config
        const status = error.response?.status

        if (status === 401 && originalRequest && !originalRequest._retry && !isAuthPath(originalRequest.url)) {
            originalRequest._retry = true
            refreshPromise ??= apiClient.post('/auth/refresh').finally(() => { refreshPromise = null })

            try {
                await refreshPromise
                return apiClient(originalRequest)
            } catch (refreshError) {
                throw toApiError(refreshError)
            }
        }

        throw toApiError(error)
    },
)

export function apiRequest(path, options = {}) {
    return apiClient({
        url: path,
        method: options.method || 'GET',
        data: options.body,
        params: options.params,
        headers: options.headers,
    })
}

export const authApi = {
    login: (body) => apiRequest('/auth/login', { method: 'POST', body }),
    verifyLoginOtp: (body) => apiRequest('/auth/verify-login-otp', { method: 'POST', body }),
    resendLoginOtp: (body) => apiRequest('/auth/resend-login-otp', { method: 'POST', body }),
    forgotPassword: (body) => apiRequest('/auth/forgot-password', { method: 'POST', body }),
    verifyOtp: (body) => apiRequest('/auth/verify-otp', { method: 'POST', body }),
    resetPassword: (body) => apiRequest('/auth/reset-password', { method: 'POST', body }),
    changePassword: (body) => apiRequest('/auth/change-password', { method: 'POST', body }),
    getMe: () => apiRequest('/auth/me'),
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
    listUsers: (params = {}) => apiRequest('/auth/users', { params }),
}

export const schoolApi = {
    list: (params = {}) => apiRequest('/schools', { params }),
    create: (body) => apiRequest('/schools', { method: 'POST', body }),
    getById: (schoolId) => apiRequest(`/schools/${schoolId}`),
    update: (schoolId, body) => apiRequest(`/schools/${schoolId}`, { method: 'PATCH', body }),
    getSettings: (schoolId) => apiRequest(`/schools/${schoolId}/settings`),
    updateSettings: (schoolId, body) => apiRequest(`/schools/${schoolId}/settings`, { method: 'PATCH', body }),
}

export const studentApi = {
    list: (params = {}) => apiRequest('/students', { params }),
    getById: (studentId) => apiRequest(`/students/${studentId}`),
    create: (body) => apiRequest('/students', { method: 'POST', body }),
    update: (studentId, body) => apiRequest(`/students/${studentId}`, { method: 'PATCH', body }),
}

export const parentApi = {
    list: (params = {}) => apiRequest('/parents', { params }),
    getById: (parentId) => apiRequest(`/parents/${parentId}`),
    create: (body) => apiRequest('/parents', { method: 'POST', body }),
    update: (parentId, body) => apiRequest(`/parents/${parentId}`, { method: 'PATCH', body }),
}

export const academicsApi = {
    listYears: (params = {}) => apiRequest('/academics/years', { params }),
    createYear: (body) => apiRequest('/academics/years', { method: 'POST', body }),
    createTerm: (body) => apiRequest('/academics/terms', { method: 'POST', body }),
    listClasses: (params = {}) => apiRequest('/academics/classes', { params }),
    createClass: (body) => apiRequest('/academics/classes', { method: 'POST', body }),
    createStream: (body) => apiRequest('/academics/streams', { method: 'POST', body }),
    listSubjects: (params = {}) => apiRequest('/academics/subjects', { params }),
    createSubject: (body) => apiRequest('/academics/subjects', { method: 'POST', body }),
}

export const attendanceApi = {
    getRegister: (params) => apiRequest('/attendance/register', { params }),
    mark: (body) => apiRequest('/attendance/mark', { method: 'POST', body }),
}

export const examApi = {
    create: (body) => apiRequest('/exams', { method: 'POST', body }),
    recordResults: (examId, body) => apiRequest(`/exams/${examId}/results`, { method: 'POST', body }),
}

export const financeApi = {
    generateInvoices: (body) => apiRequest('/finance/invoices/generate', { method: 'POST', body }),
    recordPayment: (body) => apiRequest('/finance/payments', { method: 'POST', body }),
    reminderProviders: () => apiRequest('/finance/reminders/providers'),
    listOverdueInvoices: () => apiRequest('/finance/invoices/overdue'),
    sendInvoiceReminder: (invoiceId, body) => apiRequest(`/finance/invoices/${invoiceId}/reminders`, { method: 'POST', body }),
    sendBulkReminders: (body) => apiRequest('/finance/invoices/reminders/bulk', { method: 'POST', body }),
    getReminderBatch: (batchId) => apiRequest(`/finance/invoices/reminders/batches/${batchId}`),
}

export const payrollApi = {
    executeRun: (body) => apiRequest('/payroll/runs/execute', { method: 'POST', body }),
}

export const hrApi = {
    requestLeave: (body) => apiRequest('/hr/leaves/request', { method: 'POST', body }),
    approveLeave: (leaveRequestId) => apiRequest(`/hr/leaves/${leaveRequestId}/approve`, { method: 'PATCH' }),
}

export const jobsApi = {
    get: (jobId) => apiRequest(`/jobs/${jobId}`),
}

export const reportCardApi = {
    listForTerm: (termId, params = {}) => apiRequest(`/reports/terms/${termId}`, { params }),
    queuePdf: (termId, studentId) => apiRequest(`/reports/terms/${termId}/students/${studentId}/pdf`, { method: 'POST' }),
}

export const auditApi = {
    list: (params = {}) => apiRequest('/audit-logs', { params }),
}

export const userApi = {
    createTeacher: (body) => apiRequest('/users/teachers', { method: 'POST', body }),
    createStaff: (body) => apiRequest('/users/staff', { method: 'POST', body }),
}

export const storageApi = {
    getEntityFiles: (entityType, entityId, schoolId) => apiRequest(
        `/storage/entity/${entityType}/${entityId}`,
        { headers: schoolId ? { 'x-school-id': schoolId } : undefined },
    ),
    createUploadUrl: (body, schoolId) => apiRequest('/storage/upload-url', {
        method: 'POST',
        body,
        headers: schoolId ? { 'x-school-id': schoolId } : undefined,
    }),
    registerUpload: (body, schoolId) => apiRequest('/storage/register', {
        method: 'POST',
        body,
        headers: schoolId ? { 'x-school-id': schoolId } : undefined,
    }),
}