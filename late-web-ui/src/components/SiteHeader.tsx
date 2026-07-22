import { Link, useLocation } from 'react-router-dom'
import { Radio, MessageCircle } from 'lucide-react'
import { APP_VERSION } from '@/lib/version'

const NAV_ITEMS = [
  { path: '/icecast', label: 'Radio', icon: Radio },
  { path: '/irc', label: 'Chat', icon: MessageCircle },
] as const

const PAGE_HEADERS: Record<string, { icon: typeof Radio; title: string }> = {
  '/icecast': { icon: Radio, title: 'radio · 24/7' },
  '/irc': { icon: MessageCircle, title: 'chat' },
}

function CoffeeIcon({ className = '' }: { className?: string }) {
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

export default function SiteHeader() {
  const loc = useLocation()
  const pageHeader = PAGE_HEADERS[loc.pathname]

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-11 sm:h-14 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2 group flex-shrink-0">
            <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-white shadow-sm">
              <CoffeeIcon className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
            </span>
            <span className="text-sm sm:text-lg font-extrabold tracking-tight text-slate-100 group-hover:text-white truncate">
              late.kodingvibes.com
            </span>
            <span
              className="inline-block text-[10px] font-mono font-medium text-slate-500 bg-slate-800/60 border border-slate-700/60 rounded px-1.5 py-0.5 flex-shrink-0"
              title={`Build ${APP_VERSION}`}
            >
              {APP_VERSION}
            </span>
          </Link>
          {pageHeader && (
            <>
              <span className="text-slate-700 hidden sm:inline">/</span>
              <div className="hidden sm:flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-soft flex-shrink-0">
                  <pageHeader.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-slate-100 truncate">
                    {pageHeader.title}
                  </h1>
                </div>
              </div>
            </>
          )}
        </div>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = loc.pathname.startsWith(path)
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
