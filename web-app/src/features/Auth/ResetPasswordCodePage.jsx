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