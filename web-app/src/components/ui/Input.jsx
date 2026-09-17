import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react'

const iconByType = {
    email: Mail,
    password: KeyRound,
}

export const Input = forwardRef(function Input({
    label,
    error,
    hint,
    icon: Icon,
    type = 'text',
    id,
    className = '',
    ...props
}, ref) {
    const generatedId = useId()
    const inputId = id || generatedId
    const [isVisible, setIsVisible] = useState(false)
    const isPassword = type === 'password'
    const InputIcon = Icon || iconByType[type]
    const inputType = isPassword && isVisible ? 'text' : type

    return (
        <div className="space-y-1.5">
            <div className="relative">
                {InputIcon && <InputIcon aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#7c8a80]" />}
                <input
                    ref={ref}
                    id={inputId}
                    type={inputType}
                    placeholder=" "
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
                    className={`peer w-full rounded-xl border bg-white px-4 pb-3 pt-5 text-[#17211b] outline-none transition placeholder:text-transparent focus:border-[#183d35] focus:ring-4 focus:ring-[#d3e77a]/35 ${InputIcon ? 'pl-11' : ''} ${isPassword ? 'pr-12' : ''} ${error ? 'border-[#d35e4b]' : 'border-[#dce2d8]'} ${className}`}
                    {...props}
                />
                <label htmlFor={inputId} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 bg-white px-1 text-sm text-[#7c8a80] transition-all peer-focus:top-0 peer-focus:text-xs peer-focus:font-semibold peer-focus:text-[#183d35] peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-semibold ${InputIcon ? 'left-11' : ''}`}>
                    {label}
                </label>
                {isPassword && (
                    <button type="button" aria-label={isVisible ? 'Hide password' : 'Show password'} onClick={() => setIsVisible((visible) => !visible)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#7c8a80] hover:bg-[#f0f3ed] hover:text-[#183d35]">
                        {isVisible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                    </button>
                )}
            </div>
            {error && <p id={`${inputId}-error`} className="text-xs font-medium text-[#b34d3d]">{error}</p>}
            {!error && hint && <p id={`${inputId}-hint`} className="text-xs text-[#7c8a80]">{hint}</p>}
        </div>
    )
})