function streamUrlFor(name: string): string {
  if (typeof window === 'undefined') return `/${name}`
  return `${window.location.origin}/${name}`
}

export const STREAMS = [
  { name: 'groovesalad', mount: 'groovesalad', url: streamUrlFor('groovesalad'), category: 'Groove Salad', emoji: '☾', accent: 'text-cyan-400' },
  { name: 'dronezone',   mount: 'dronezone',   url: streamUrlFor('dronezone'),   category: 'Drone Zone',   emoji: '♪', accent: 'text-amber-400' },
  { name: 'fluid',       mount: 'fluid',       url: streamUrlFor('fluid'),       category: 'Fluid',        emoji: '◐', accent: 'text-purple-400' },
  { name: 'indiepop',    mount: 'indiepop',    url: streamUrlFor('indiepop'),    category: 'Indie Pop',    emoji: '♥', accent: 'text-pink-400' },
  { name: 'u80s',        mount: 'u80s',        url: streamUrlFor('u80s'),        category: 'Underground 80s', emoji: '♫', accent: 'text-orange-400' },
  { name: 'vaporwaves',  mount: 'vaporwaves',  url: streamUrlFor('vaporwaves'),  category: 'Vaporwaves',   emoji: '◢', accent: 'text-fuchsia-400' },
  { name: 'metal',       mount: 'metal',       url: streamUrlFor('metal'),       category: 'Metal',        emoji: '♬', accent: 'text-rose-400' },
  { name: 'dubstep',     mount: 'dubstep',     url: streamUrlFor('dubstep'),     category: 'Dub Step',     emoji: '◤', accent: 'text-lime-400' },
  { name: '7soul',       mount: '7soul',       url: streamUrlFor('7soul'),       category: '7 Soul',       emoji: '♯', accent: 'text-indigo-400' },
  { name: 'beatblender', mount: 'beatblender', url: streamUrlFor('beatblender'), category: 'Beat Blender', emoji: '◍', accent: 'text-teal-400' },
  { name: 'bootliquor',  mount: 'bootliquor',  url: streamUrlFor('bootliquor'),  category: 'Boot Liquor',  emoji: '⛰', accent: 'text-amber-600' },
  { name: 'doomed',      mount: 'doomed',      url: streamUrlFor('doomed'),      category: 'Doomed',       emoji: '†', accent: 'text-red-400' },
  { name: 'illstreet',   mount: 'illstreet',   url: streamUrlFor('illstreet'),   category: 'Illinois Street Lounge', emoji: '⌛', accent: 'text-yellow-400' },
  { name: 'lush',        mount: 'lush',        url: streamUrlFor('lush'),        category: 'Lush',         emoji: '❀', accent: 'text-pink-300' },
  { name: 'poptron',     mount: 'poptron',     url: streamUrlFor('poptron'),     category: 'PopTron',      emoji: '◎', accent: 'text-sky-400' },
  { name: 'secretagent', mount: 'secretagent', url: streamUrlFor('secretagent'), category: 'Secret Agent', emoji: '⌂', accent: 'text-slate-300' },
  { name: 'suburbsofgoa', mount: 'suburbsofgoa', url: streamUrlFor('suburbsofgoa'), category: 'Suburbs of Goa', emoji: '◈', accent: 'text-emerald-400' },
  { name: 'thetrip',     mount: 'thetrip',     url: streamUrlFor('thetrip'),     category: 'The Trip',     emoji: '⟐', accent: 'text-violet-400' },
]

export interface SourceLabel {
  name: string
  emoji: string
  color: string
}

export const SOURCE_LABELS: Record<string, SourceLabel> = {}
for (const s of STREAMS) {
  SOURCE_LABELS[s.name] = { name: s.name, emoji: s.emoji!, color: s.accent! }
}
