import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'
import { FormMessage } from '../../components/ui/FormMessage.jsx'
import { Input } from '../../components/ui/Input.jsx'
import { newPasswordSchema } from './auth.schemas.js'
import { useAuthForm, maskEmail } from './authPageUtils.js'
import { AuthLayout } from '../../components/layout/AuthLayout.jsx'

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