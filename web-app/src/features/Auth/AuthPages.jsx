import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, LogOut, RefreshCw } from 'lucide-react'
import { authApi } from '../../api/client.js'
import { changePasswordSchema, emailSchema, loginSchema, newPasswordSchema, otpSchema } from './auth.schemas.js'
import { AuthLayout } from '../../components/layout/AuthLayout.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { FormMessage } from '../../components/ui/FormMessage.jsx'
import { Input } from '../../components/ui/Input.jsx'

function useAuthForm(schema, defaultValues) {
    return useForm({ resolver: zodResolver(schema), defaultValues, mode: 'onBlur' })
}

function maskEmail(email) {
    const [localPart, domain] = email.split('@')
    if (!localPart || !domain) return email

    if (localPart.length <= 4) {
        return `${localPart}***@${domain}`
    }

    return `${localPart.slice(0, 2)}${'*'.repeat(localPart.length - 4)}${localPart.slice(-2)}@${domain}`
}


export function LoginPage() {
    const navigate = useNavigate()
    const form = useAuthForm(loginSchema, { email: '', password: '' })
    const mutation = useMutation({
        mutationFn: authApi.login,
        onSuccess: ({ data }) => navigate('/verify-login', { state: { ...data } }),
    })
    return <AuthLayout title="Welcome back.">
        <p className="mb-7 text-sm leading-6 text-[#66756b]">Sign in to continue to your school workspace. We will send a verification code after your password is accepted.</p>
        <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormMessage message={mutation.error?.message} />
            <Input label="Email address" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
            <Input label="Password" type="password" autoComplete="current-password" {...form.register('password')} error={form.formState.errors.password?.message} />
            <div className="flex justify-end"><Link className="text-sm font-bold text-[#b34d3d] hover:underline" to="/forgot-password">Forgot password?</Link></div>
            <Button type="submit" size="lg" className="w-full" isPending={mutation.isPending} icon={<ArrowRight aria-hidden="true" className="h-5 w-5" />}>Continue to verification</Button>
        </form>
    </AuthLayout>
}

export function LoginOtpPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { userId, email, username, expiresAt: initialExpiresAt } = location.state || {}
    const [seconds, setSeconds] = useState(30)
    const [expiresAt, setExpiresAt] = useState(initialExpiresAt || 0)
    const [remaining, setRemaining] = useState(0)
    const form = useAuthForm(otpSchema, { otp: '' })
    const verify = useMutation({
        mutationFn: (values) => authApi.verifyLoginOtp({ ...values, userId }),
        onSuccess: ({ data }) => navigate('/workspace', { replace: true, state: { user: data.user } }),
    })
    const resend = useMutation({
        mutationFn: () => authApi.resendLoginOtp({ userId }),
        onSuccess: ({ data }) => {
            setSeconds(30)
            setExpiresAt(data?.expiresAt || 0)
        },
    })
    useEffect(() => {
        if (!seconds) return undefined
        const timer = setInterval(() => setSeconds((value) => value - 1), 1000)
        return () => clearInterval(timer)
    }, [seconds])
    useEffect(() => {
        if (!expiresAt) return undefined
        const updateRemaining = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()))
        updateRemaining()
        const timer = setInterval(updateRemaining, 1000)
        return () => clearInterval(timer)
    }, [expiresAt])
    const expiryMinutes = Math.floor(remaining / 60000)
    const expirySeconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0')
    if (!userId) return <AuthLayout title="Verification link expired."><p className="text-sm leading-6 text-[#66756b]">Start again so we can send a fresh verification code.</p><Link className="mt-6 inline-block font-bold text-[#b34d3d]" to="/login">Return to sign in</Link></AuthLayout>
    return <AuthLayout eyebrow="Identity check" title="Enter your code.">
        <p className="mb-7 text-sm leading-6 text-[#66756b]">We sent a six-digit code to <strong className="text-[#304139]">{email ? maskEmail(email) : username || 'your email'}</strong>. It expires shortly.</p>
        <form className="space-y-5" onSubmit={form.handleSubmit((values) => verify.mutate(values))}>
            <FormMessage message={verify.error?.message || resend.error?.message} />
            <Input label="6-digit verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...form.register('otp')} error={form.formState.errors.otp?.message} />
            <Button type="submit" className="w-full" isPending={verify.isPending} icon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>Verify and sign in</Button>
        </form>
        <p className={`mt-4 text-center text-xs font-semibold ${remaining ? 'text-[#7c8a80]' : 'text-[#b34d3d]'}`}>{remaining ? `Code expires in ${expiryMinutes}:${expirySeconds}` : 'This code has expired'}</p>
        <Button type="button" variant="quiet" isPending={resend.isPending} disabled={seconds > 0} icon={<RefreshCw aria-hidden="true" className="h-4 w-4" />} onClick={() => resend.mutate()} className="mt-3 w-full">{seconds > 0 ? `Resend code in ${seconds}s` : 'Resend verification code'}</Button>
    </AuthLayout>
}

export function ForgotPasswordPage() {
    const navigate = useNavigate()
    const form = useAuthForm(emailSchema, { email: '' })
    const mutation = useMutation({
        mutationFn: authApi.forgotPassword,
        onSuccess: (_, variables) => navigate('/reset-password', { state: { email: variables.email, expiresAt: Date.now() + 10 * 60 * 1000 } }),
    })
    return <AuthLayout eyebrow="Account recovery" title="Reset your password.">
        <p className="mb-7 text-sm leading-6 text-[#66756b]">Enter your account email and we will send a reset code if the account exists.</p>
        <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormMessage message={mutation.error?.message} />
            <Input label="Email address" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
            <Button type="submit" className="w-full" isPending={mutation.isPending} icon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>Send reset code</Button>
        </form>
        <p className="mt-6 text-center text-sm text-[#66756b]">Remembered it? <Link className="font-bold text-[#b34d3d]" to="/login">Back to sign in</Link></p>
    </AuthLayout>
}

export function ResetPasswordCodePage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { email, expiresAt: initialExpiresAt } = location.state || {}
    const [expiresAt, setExpiresAt] = useState(initialExpiresAt || 0)
    const [remaining, setRemaining] = useState(0)
    const [isExpired, setIsExpired] = useState(false)
    const form = useAuthForm(otpSchema, { otp: '' })
    const verify = useMutation({
        mutationFn: (values) => authApi.verifyOtp({ email, ...values }),
        onSuccess: (_, values) => navigate('/reset-password/new', { state: { email, otp: values.otp, expiresAt } }),
    })
    const resend = useMutation({
        mutationFn: () => authApi.forgotPassword({ email }),
        onSuccess: () => {
            const nextExpiry = Date.now() + 10 * 60 * 1000
            setExpiresAt(nextExpiry)
            setRemaining(10 * 60 * 1000)
            setIsExpired(false)
        },
    })
    useEffect(() => {
        if (!expiresAt) return undefined
        const updateRemaining = () => {
            const nextRemaining = Math.max(0, expiresAt - Date.now())
            setRemaining(nextRemaining)
            setIsExpired(nextRemaining === 0)
        }
        updateRemaining()
        const timer = setInterval(updateRemaining, 1000)
        return () => clearInterval(timer)
    }, [expiresAt])
    const minutes = Math.floor(remaining / 60000).toString().padStart(2, '0')
    const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0')
    if (!email) return <AuthLayout eyebrow="Account recovery" title="Start again."><p className="text-center text-sm text-[#66756b]">Enter your email first so we can send a reset code.</p><Link className="mt-6 block text-center font-bold text-[#b34d3d]" to="/forgot-password">Return to recovery</Link></AuthLayout>
    return <AuthLayout eyebrow="Account recovery" title="Check your email.">
        <p className="mb-7 text-center text-sm leading-6 text-[#66756b]">Enter the six-digit reset code sent to <strong className="text-[#304139]">{maskEmail(email)}</strong>.</p>
        <form className="space-y-5" onSubmit={form.handleSubmit((values) => verify.mutate(values))}>
            <FormMessage message={verify.error?.message || resend.error?.message} />
            <Input label="Reset code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...form.register('otp')} error={form.formState.errors.otp?.message} />
            <p className={`text-center text-xs font-semibold ${remaining ? 'text-[#7c8a80]' : 'text-[#b34d3d]'}`}>{remaining ? `Code expires in ${minutes}:${seconds}` : 'This code has expired'}</p>
            <Button type="submit" className="w-full" isPending={verify.isPending} disabled={isExpired} icon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>Continue</Button>
        </form>
        <Button type="button" variant="quiet" className="mt-3 w-full" isPending={resend.isPending} icon={<RefreshCw aria-hidden="true" className="h-4 w-4" />} onClick={() => resend.mutate()}>Resend reset code</Button>
        <p className="mt-5 text-center text-sm text-[#66756b]"><Link className="font-bold text-[#b34d3d]" to="/login">Back to sign in</Link></p>
    </AuthLayout>
}

export function ResetPasswordPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { email, otp, expiresAt } = location.state || {}
    const form = useAuthForm(newPasswordSchema, { newPassword: '', confirmPassword: '' })
    const [isExpired, setIsExpired] = useState(false)
    const mutation = useMutation({
        mutationFn: (values) => authApi.resetPassword({ email, otp, newPassword: values.newPassword }),
        onSuccess: () => navigate('/login', { replace: true, state: { message: 'Password reset. Sign in with your new password.' } }),
    })
    useEffect(() => {
        if (!expiresAt) return undefined
        const updateExpired = () => setIsExpired(expiresAt <= Date.now())
        updateExpired()
        const timer = setInterval(updateExpired, 1000)
        return () => clearInterval(timer)
    }, [expiresAt])
    if (!email || !otp || isExpired) return <AuthLayout eyebrow="Account recovery" title="Code expired."><p className="text-center text-sm text-[#66756b]">Request a new reset code to continue.</p><Link className="mt-6 block text-center font-bold text-[#b34d3d]" to="/forgot-password">Request a new code</Link></AuthLayout>
    return <AuthLayout eyebrow="Account recovery" title="Choose a new password.">
        <p className="mb-7 text-center text-sm leading-6 text-[#66756b]">Create a strong password for <strong className="text-[#304139]">{maskEmail(email)}</strong>.</p>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormMessage message={mutation.error?.message} />
            <Input label="New password" type="password" autoComplete="new-password" {...form.register('newPassword')} error={form.formState.errors.newPassword?.message} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" onCopy={(event) => event.preventDefault()} onPaste={(event) => event.preventDefault()} {...form.register('confirmPassword')} error={form.formState.errors.confirmPassword?.message} />
            <Button type="submit" className="w-full" isPending={mutation.isPending} icon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>Reset password</Button>
        </form>
    </AuthLayout>
}

export function ChangePasswordPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const form = useAuthForm(changePasswordSchema, { currentPassword: '', newPassword: '', confirmPassword: '' })
    const mutation = useMutation({
        mutationFn: (values) => authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
        onSuccess: () => { queryClient.clear(); navigate('/login', { replace: true, state: { message: 'Password changed. Sign in again.' } }) },
    })
    return <AuthLayout eyebrow="Security required" title="Protect your account.">
        <p className="mb-7 text-sm leading-6 text-[#66756b]">Your administrator requires a new password before you can continue.</p>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormMessage message={mutation.error?.message} />
            <Input label="Current password" type="password" autoComplete="current-password" {...form.register('currentPassword')} error={form.formState.errors.currentPassword?.message} />
            <Input label="New password" type="password" autoComplete="new-password" {...form.register('newPassword')} error={form.formState.errors.newPassword?.message} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" onCopy={(event) => event.preventDefault()} onPaste={(event) => event.preventDefault()} {...form.register('confirmPassword')} error={form.formState.errors.confirmPassword?.message} />
            <Button type="submit" className="w-full" isPending={mutation.isPending} icon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>Update password</Button>
        </form>
    </AuthLayout>
}

export function WorkspacePage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { data, isPending, isError } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.getMe })
    const logout = useMutation({ mutationFn: authApi.logout, onSettled: () => { queryClient.clear(); navigate('/login', { replace: true }) } })
    const user = data?.data
    if (isPending) return <div className="grid min-h-screen place-items-center bg-[#f6f7f2] text-sm text-[#66756b]">Loading your workspace...</div>
    if (isError) return <AuthLayout title="Your session has ended."><p className="text-sm text-[#66756b]">Sign in again to access the school workspace.</p><Link className="mt-6 inline-block font-bold text-[#b34d3d]" to="/login">Return to sign in</Link></AuthLayout>
    return <main className="min-h-screen bg-[#f6f7f2] text-[#17211b]"><header className="border-b border-[#dce2d8] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><div><p className="text-xs font-bold tracking-[0.2em] text-[#b34d3d] uppercase">School SMIS</p><h1 className="mt-1 font-serif text-2xl text-[#183d35]">Good to see you, {user?.firstName || user?.username || 'there'}.</h1></div><Button type="button" variant="secondary" isPending={logout.isPending} icon={<LogOut aria-hidden="true" className="h-4 w-4" />} onClick={() => logout.mutate()}>Sign out</Button></div></header><section className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><div className="rounded-3xl bg-[#183d35] p-7 text-white sm:p-10"><p className="text-xs font-bold tracking-[0.2em] text-[#d3e77a] uppercase">{user?.role || 'Authenticated user'}</p><h2 className="mt-3 max-w-xl font-serif text-4xl leading-tight">Your workspace is ready for the day.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-[#c5d1c2]">Your role-based modules will appear here as they are connected to the school operations dashboard.</p></div></section></main>
}