import axios from 'axios'

const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '')

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
}