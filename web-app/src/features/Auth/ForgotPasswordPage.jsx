import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'
import { FormMessage } from '../../components/ui/FormMessage.jsx'
import { Input } from '../../components/ui/Input.jsx'
import { emailSchema } from './auth.schemas.js'
import { useAuthForm } from './authPageUtils.js'
import { AuthLayout } from '../../components/layout/AuthLayout.jsx'

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