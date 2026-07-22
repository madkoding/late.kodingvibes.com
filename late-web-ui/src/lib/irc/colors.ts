const NICK_COLORS = [
  '#e06c75', '#d19a66', '#e5c07b', '#98c379',
  '#56b6c2', '#61afef', '#c678dd', '#be5046',
  '#7ec8e3', '#b4e197', '#f5ab79', '#c3a6ff',
  '#f0c674', '#8abeb7', '#81a2be', '#b294bb',
]

export function getNickColor(nick: string): string {
  let hash = 0
  for (let i = 0; i < nick.length; i++) {
    hash = ((hash << 5) - hash) + nick.charCodeAt(i)
    hash |= 0
  }
  return NICK_COLORS[Math.abs(hash) % NICK_COLORS.length]
}
