import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'
import { FormMessage } from '../../components/ui/FormMessage.jsx'
import { Input } from '../../components/ui/Input.jsx'
import { otpSchema } from './auth.schemas.js'
import { useAuthForm, maskEmail } from './authPageUtils.js'
import { AuthLayout } from '../../components/layout/AuthLayout.jsx'

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