import { useState } from 'react'

interface NickPromptModalProps {
  suggestedNick: string
  onSubmit: (nick: string) => void
  onCancel: () => void
}

export default function NickPromptModal({ suggestedNick, onSubmit, onCancel }: NickPromptModalProps) {
  const [nick, setNick] = useState(suggestedNick)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nick.trim()
    if (trimmed.length < 2 || trimmed.length > 32) {
      setError('El nick debe tener entre 2 y 32 caracteres')
      return
    }
    if (!/^[a-zA-Z0-9_\-\[\]\\`^{}|]+$/.test(trimmed)) {
      setError('Caracteres inválidos en el nick')
      return
    }
    onSubmit(trimmed)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 select-none animate-fade-in">
      <div className="bg-slate-900 rounded-xl p-8 w-full max-w-md mx-4 shadow-floating border border-slate-800 animate-scale-in">
        <h2 className="text-xl font-bold text-slate-100 mb-2">Elige tu nick</h2>
        <p className="text-slate-400 text-sm mb-6">
          Este será tu identidad en el chat del cowork virtual.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={nick}
            onChange={(e) => { setNick(e.target.value); setError('') }}
            className="w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-lg font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            autoFocus
            maxLength={32}
          />
          {error && <p className="text-rose-400 text-sm mt-2">{error}</p>}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-400 transition-colors"
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
