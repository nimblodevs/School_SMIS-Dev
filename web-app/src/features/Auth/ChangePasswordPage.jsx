import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/client.js'
import { Button } from '../../components/ui/Button.jsx'
import { FormMessage } from '../../components/ui/FormMessage.jsx'
import { Input } from '../../components/ui/Input.jsx'
import { changePasswordSchema } from './auth.schemas.js'
import { useAuthForm } from './authPageUtils.js'
import { AuthLayout } from '../../components/layout/AuthLayout.jsx'

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