import { Link } from 'react-router-dom'
import { Radio, MessageCircle, Play } from 'lucide-react'
import MiniPlayer from '@/audio/MiniPlayer'
import { useAudio } from '@/audio/AudioProvider'
import useDocumentTitle from '@/lib/use-document-title'

const FEATURED_STREAMS = [
  { name: 'Groovesalad', mount: 'groovesalad', color: 'bg-emerald-500' },
  { name: 'Drone Zone', mount: 'dronezone', color: 'bg-indigo-500' },
  { name: 'Fluid', mount: 'fluid', color: 'bg-cyan-500' },
  { name: 'Indie Pop', mount: 'indiepop', color: 'bg-rose-500' },
  { name: 'Vaporwaves', mount: 'vaporwaves', color: 'bg-purple-500' },
  { name: 'Dub Step', mount: 'dubstep', color: 'bg-amber-500' },
]

export function Home() {
  const audio = useAudio()
  useDocumentTitle()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 sm:pb-12">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">
          un rinconcito comfy, tarde en la noche
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl">
          chat, radio y esquinas tranquilas para los que viven en una terminal.
          quédate un rato.
        </p>
      </section>

      {/* Section: rooms */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        <h2 className="text-xs font-mono uppercase text-slate-500 tracking-wider mb-3">
          # salas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            to="/irc"
            className="group block rounded-2xl border border-slate-800 bg-slate-900/40 p-5 hover:border-indigo-500/50 hover:bg-slate-900/80 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-indigo-400" />
              <span className="font-mono text-sm text-slate-300">#chat</span>
            </div>
            <p className="text-slate-200 font-semibold mb-1">chat</p>
            <p className="text-sm text-slate-500">
              el mismo chat de kodingvibes, con algunas salas extra.
            </p>
          </Link>

          <Link
            to="/icecast"
            className="group block rounded-2xl border border-slate-800 bg-slate-900/40 p-5 hover:border-indigo-500/50 hover:bg-slate-900/80 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-indigo-400" />
              <span className="font-mono text-sm text-slate-300">#radio</span>
            </div>
            <p className="text-slate-200 font-semibold mb-1">streams 24/7</p>
            <p className="text-sm text-slate-500">
              groovesalad, dronezone, vaporwaves, dubstep y más.
            </p>
          </Link>
        </div>
      </section>

      {/* Section: Featured streams */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono uppercase text-slate-500 tracking-wider">
            # destacadas
          </h2>
          <Link
            to="/icecast"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            todas las emisoras →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FEATURED_STREAMS.map((s) => {
            const isCurrent = audio.current?.mount === s.mount
            return (
              <button
                key={s.mount}
                onClick={() => {
                  audio.play({
                    name: s.name,
                    mount: s.mount,
                    url: `https://late.kodingvibes.com/${s.mount}`,
                  })
                }}
                className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  isCurrent
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900/80'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center flex-shrink-0`}>
                  {isCurrent && audio.playing ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-white translate-x-[1px]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100 truncate">{s.name}</p>
                  <p className="text-[10px] font-mono text-slate-500 truncate">/{s.mount}</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <MiniPlayer />
    </div>
  )
}

export default Home
