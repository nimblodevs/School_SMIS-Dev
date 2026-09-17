import { Link } from 'react-router-dom'

export function AuthLayout({ eyebrow = 'School operations, in one place', title, children }) {
  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#17211b] lg:grid lg:grid-cols-[minmax(360px,0.9fr)_1.1fr]">
      <section className="relative hidden overflow-hidden bg-[#183d35] p-12 text-[#f5f3e9] lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-28 h-96 w-96 rounded-full border-[60px] border-[#d3e77a]/20" />
        <div className="absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full border-[80px] border-[#ef765f]/20" />
        <div className="relative">
          <Link to="/login" className="inline-flex items-center gap-3 text-sm font-semibold tracking-[0.18em] text-[#d3e77a] uppercase">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d3e77a] text-lg text-[#183d35]">S</span>
            School SMIS
          </Link>
        </div>
        <div className="relative max-w-lg pb-10">
          <p className="mb-5 text-xs font-bold tracking-[0.24em] text-[#d3e77a] uppercase">{eyebrow}</p>
          <h2 className="font-serif text-5xl leading-[0.98] tracking-[-0.03em]">A calmer way to run the school day.</h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[#c5d1c2]">Secure access for the people who teach, support, manage, and care for every learner.</p>
        </div>
        <p className="relative text-xs text-[#9bb3a4]">School Management Information System</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Link to="/login" className="inline-flex items-center gap-3 text-sm font-bold tracking-[0.18em] text-[#183d35] uppercase">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183d35] text-lg text-[#d3e77a]">S</span>
              School SMIS
            </Link>
          </div>
          <p className="mb-3 text-xs font-bold tracking-[0.22em] text-[#d35e4b] uppercase">{eyebrow}</p>
          <h1 className="font-serif text-4xl leading-tight tracking-[-0.03em] text-[#183d35]">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  )
}

export function Field({ label, error, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#304139]">{label}</span>
      <input
        className={`w-full rounded-xl border bg-white px-4 py-3.5 text-[#17211b] outline-none transition placeholder:text-[#9aa69d] focus:border-[#183d35] focus:ring-4 focus:ring-[#d3e77a]/35 ${error ? 'border-[#d35e4b]' : 'border-[#dce2d8]'}`}
        {...props}
      />
      {error && <span className="mt-1.5 block text-xs font-medium text-[#b34d3d]">{error}</span>}
    </label>
  )
}

export function FormError({ message }) {
  if (!message) return null
  return <div role="alert" className="rounded-xl border border-[#efb5aa] bg-[#fff2ef] px-4 py-3 text-sm text-[#9b3d30]">{message}</div>
}

export function SubmitButton({ children, isPending }) {
  return <button disabled={isPending} className="w-full rounded-xl bg-[#183d35] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#24574b] disabled:cursor-not-allowed disabled:opacity-60">{isPending ? 'Please wait...' : children}</button>
}