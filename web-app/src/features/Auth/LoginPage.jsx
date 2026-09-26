import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'
import { FormMessage } from '../../components/ui/FormMessage.jsx'
import { Input } from '../../components/ui/Input.jsx'
import { loginSchema } from './auth.schemas.js'
import { useAuthForm } from './authPageUtils.js'
import { AuthLayout } from '../../components/layout/AuthLayout.jsx'

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