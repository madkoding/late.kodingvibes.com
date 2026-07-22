import { getNickColor } from '../../lib/irc/colors'

interface AvatarProps {
  nick: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-10 h-10 text-sm',
}

export default function Avatar({ nick, size = 'md', className = '' }: AvatarProps) {
  const initials = nick
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase() || '?'
  const color = getNickColor(nick)

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
      title={nick}
    >
      {initials}
    </div>
  )
}
