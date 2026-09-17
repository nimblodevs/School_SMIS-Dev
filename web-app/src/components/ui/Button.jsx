import { LoaderCircle } from 'lucide-react'

const variants = {
    primary: 'bg-[#183d35] text-white hover:bg-[#24574b] focus-visible:ring-[#d3e77a]/70',
    secondary: 'border border-[#dce2d8] bg-white text-[#304139] hover:border-[#183d35] hover:bg-[#f8faf6] focus-visible:ring-[#d3e77a]/70',
    quiet: 'text-[#b34d3d] hover:bg-[#fff2ef] focus-visible:ring-[#efb5aa]/70',
}

const sizes = {
    md: 'px-5 py-3.5 text-sm',
    lg: 'min-h-14 px-6 py-4 text-base',
}

export function Button({ children, variant = 'primary', size = 'md', icon, isPending = false, className = '', ...props }) {
    return (
        <button
            aria-busy={isPending}
            className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${variants[variant]} ${className}`}
            disabled={isPending || props.disabled}
            {...props}
        >
            {isPending && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {isPending ? 'Please wait...' : children}
            {!isPending && icon}
        </button>
    )
}