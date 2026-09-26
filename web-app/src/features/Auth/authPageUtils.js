import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export function useAuthForm(schema, defaultValues) {
  return useForm({ resolver: zodResolver(schema), defaultValues, mode: 'onBlur' })
}

export function maskEmail(email) {
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return email

  if (localPart.length <= 4) {
    return `${localPart}***@${domain}`
  }

  return `${localPart.slice(0, 2)}${'*'.repeat(localPart.length - 4)}${localPart.slice(-2)}@${domain}`
}