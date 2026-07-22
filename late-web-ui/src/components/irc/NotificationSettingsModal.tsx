import { useState } from 'react'
import { X } from 'lucide-react'

export interface NotifPrefs {
  mode: 'mentions' | 'all' | 'none'
  volume: number
  sound: boolean
  vibration: boolean
  system: boolean
}

interface NotificationSettingsModalProps {
  prefs: NotifPrefs
  onSave: (prefs: NotifPrefs) => void
  onClose: () => void
}

export default function NotificationSettingsModal({ prefs, onSave, onClose }: NotificationSettingsModalProps) {
  const [mode, setMode] = useState(prefs.mode)
  const [volume, setVolume] = useState(prefs.volume)
  const [sound, setSound] = useState(prefs.sound)
  const [vibration, setVibration] = useState(prefs.vibration)
  const [system, setSystem] = useState(prefs.system)

  const handleSave = () => {
    onSave({ mode, volume, sound, vibration, system })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none animate-fade-in" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-floating animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Notificaciones</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Modo</label>
          <div className="space-y-1.5">
            {[
              { value: 'mentions' as const, label: 'Menciones', desc: 'Solo cuando te mencionan o te responden' },
              { value: 'all' as const, label: 'Todos los mensajes', desc: 'Cada mensaje nuevo (sin sonido)' },
              { value: 'none' as const, label: 'Ninguna', desc: 'Silenciar todo' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  mode === opt.value
                    ? 'bg-indigo-500/20 border border-indigo-500/40'
                    : 'bg-slate-800/50 border border-transparent hover:bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  mode === opt.value ? 'border-indigo-400' : 'border-slate-600'
                }`}>
                  {mode === opt.value && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-200">{opt.label}</div>
                  <div className="text-[11px] text-slate-500">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Volume */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
            Volumen de sonido
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-sm text-slate-300 tabular-nums w-10 text-right">{volume}%</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 mb-6">
          {[
            { key: 'sound' as const, label: 'Sonido al recibir mención', value: sound, set: setSound },
            { key: 'vibration' as const, label: 'Vibración en mobile', value: vibration, set: setVibration },
            { key: 'system' as const, label: 'Notificaciones del sistema (pestaña oculta)', value: system, set: setSystem },
          ].map(t => (
            <label key={t.key} className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-slate-300">{t.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={t.value}
                onClick={() => t.set(!t.value)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  t.value ? 'bg-indigo-500' : 'bg-slate-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  t.value ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition-colors text-sm"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
