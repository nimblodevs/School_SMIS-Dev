import { GraduationCap } from 'lucide-react'
import { Link } from 'react-router-dom'

export function AuthLayout({ eyebrow = 'School operations, in one place', title, children }) {
    return (
        <main className="relative h-screen overflow-hidden bg-white pb-14 text-[#17211b] lg:grid lg:grid-cols-[minmax(360px,0.9fr)_1.1fr]">
            {/* Left panel: branded context and security messaging. */}
            <section className="relative hidden h-screen overflow-hidden bg-white p-12 text-[#183d35] lg:flex lg:flex-col lg:justify-between xl:p-16">
                <div className="relative">
                    <Link to="/login" className="inline-flex items-center gap-3 text-sm font-semibold tracking-[0.18em] text-[#183d35] uppercase">
                        <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#dce2d8] text-[#183d35]"><GraduationCap aria-hidden="true" className="h-5 w-5" /></span>
                        <span className="flex flex-col leading-none"><span className="text-[0.65rem] tracking-[0.24em] text-[#66756b]">SCHOOL</span><span className="mt-1 text-sm tracking-[0.18em] text-[#183d35]">SMIS</span></span>
                    </Link>
                </div>
                <div className="relative max-w-lg pb-10">
                    <div className="mb-8 flex items-center gap-3 text-xs font-bold tracking-[0.16em] text-[#b34d3d] uppercase">
                        Secure school access
                    </div>
                    <p className="mb-5 text-xs font-bold tracking-[0.24em] text-[#b34d3d] uppercase">{eyebrow}</p>
                    <h2 className="font-serif text-5xl leading-[0.98] tracking-[-0.03em] text-[#183d35]">A calmer way to run the school day.</h2>
                    <p className="mt-6 max-w-md text-base leading-7 text-[#66756b]">Secure access for the people who teach, support, manage, and care for every learner.</p>
                </div>
                <div className="relative flex items-center justify-between border-t border-[#dce2d8] pt-5 text-xs">
                    <span className="font-semibold tracking-[0.16em] text-[#b34d3d] uppercase">Workspace access</span>
                    <span className="flex items-center gap-2 text-[#66756b]"><span className="h-2 w-2 rounded-full bg-[#b34d3d]" />Protected session</span>
                </div>
            </section>
            {/* Right panel: page-specific authentication form and content. */}
            <section className="flex h-screen items-center justify-center overflow-hidden bg-white px-5 py-10 sm:px-10 lg:px-16">
                <div className="w-full max-w-md rounded-3xl border border-[#e6ebe4] bg-white p-6 shadow-[0_24px_70px_rgba(24,61,53,0.08)] sm:p-9">
                    <div className="mb-10 lg:hidden"><Link to="/login" className="inline-flex items-center gap-3 text-sm font-bold tracking-[0.18em] text-[#183d35] uppercase"><span className="grid h-10 w-10 place-items-center rounded-xl border border-[#dce2d8] text-[#183d35]"><GraduationCap aria-hidden="true" className="h-5 w-5" /></span><span className="flex flex-col text-left leading-none"><span className="text-[0.65rem] tracking-[0.24em] text-[#66756b]">SCHOOL</span><span className="mt-1 text-sm tracking-[0.18em] text-[#183d35]">SMIS</span></span></Link></div>
                    <p className="mb-3 text-center text-xs font-bold tracking-[0.22em] text-[#d35e4b] uppercase">{eyebrow}</p>
                    <h1 className="text-center font-serif text-4xl leading-tight tracking-[-0.03em] text-[#183d35]">{title}</h1>
                    <div className="mt-8">{children}</div>
                </div>
            </section>
            <p className="absolute bottom-4 left-1/2 w-full -translate-x-1/2 px-5 text-center text-xs text-[#7c8a80]">&copy; {new Date().getFullYear()} School SMIS. All rights reserved.</p>
        </main>
    )
}