import { useEffect } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  side?: 'left' | 'right'
  className?: string
  children: React.ReactNode
}

export default function Drawer({ open, onClose, side = 'left', className = '', children }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 sm:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div
        className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} w-72 max-w-[85vw] bg-slate-900 border-slate-800 ${side === 'left' ? 'border-r' : 'border-l'} shadow-2xl flex flex-col ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
