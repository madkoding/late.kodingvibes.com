// ponytail: the same three-orb coffee icon used in SiteHeader. Inlined so
// this file can be served from index.html as a static <div> (pre-React).
export function CoffeeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )
}

export function AppLoader({ label = 'cargando…', fixed = false }: { label?: string; fixed?: boolean }) {
  return (
    <div className={fixed
      ? "fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950"
      : "min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-slate-950"
    }>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-white shadow-lg">
          <CoffeeIcon className="w-6 h-6 sm:w-7 sm:h-7" />
        </span>
        <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-100">
          late.kodingvibes.com
        </span>
      </div>
      <div className="flex items-center gap-2 text-slate-500 text-xs sm:text-sm">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: '300ms' }} />
        <span className="ml-2">{label}</span>
      </div>
    </div>
  )
}
