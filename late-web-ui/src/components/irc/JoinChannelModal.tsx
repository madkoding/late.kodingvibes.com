import { useState } from 'react'

interface JoinChannelModalProps {
  onSubmit: (name: string) => void
  onCancel: () => void
}

export default function JoinChannelModal({ onSubmit, onCancel }: JoinChannelModalProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Escribe un nombre')
      return
    }
    if (!/^[a-zA-Z0-9_\-]{2,40}$/.test(trimmed.replace(/^#/, ''))) {
      setError('Solo letras, números, guiones y guiones bajos (2-40 caracteres)')
      return
    }
    onSubmit(trimmed.startsWith('#') ? trimmed : '#' + trimmed)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-floating border border-slate-800 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-100 mb-1">Crear canal</h2>
        <p className="text-slate-400 text-sm mb-5">
          Escribe el nombre del canal sin el # inicial.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-lg select-none">
              #
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-base font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              autoFocus
              placeholder="mi-canal"
              maxLength={40}
            />
          </div>
          {error && <p className="text-rose-400 text-xs mt-2">{error}</p>}
          <div className="flex gap-2 mt-5">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition-colors text-sm"
            >
              Crear
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
