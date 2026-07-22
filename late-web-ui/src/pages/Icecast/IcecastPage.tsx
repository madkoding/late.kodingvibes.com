import { Layout } from '@/components/Layout'
import MiniPlayer from '@/audio/MiniPlayer'
import { useAudio } from '@/audio/AudioProvider'
import useDocumentTitle from '@/lib/use-document-title'
import { SOURCE_LABELS } from '@/lib/streams'
import { useIcecastStatus } from './useIcecastStatus'
import { MountCard } from './MountCard'
import type { MountView } from './useIcecastStatus'

export function Icecast() {
  const audio = useAudio()
  useDocumentTitle()
  const { mounts, totalListeners, isLoading } = useIcecastStatus()

  const handlePlay = (mount: MountView) => {
    const label = SOURCE_LABELS[mount.name]
    audio.play({
      name: mount.display_name,
      mount: mount.name,
      url: mount.stream_url,
      artist: mount.current_artist ?? undefined,
      title: mount.current_track ?? undefined,
      category: label?.name ?? mount.name,
      emoji: label?.emoji ?? '♪',
      accent: label?.color ?? 'text-indigo-400',
    })
  }

  return (
    <>
      <Layout title="icecast">
        <div className="kv-section py-6 sm:py-10 max-w-5xl">
          <p className="text-sm text-slate-400 mb-6">
            {`${totalListeners} oyentes · ${mounts.length} emisoras`}
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-800/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mounts.map((mount) => (
                <MountCard
                  key={mount.name}
                  mount={mount}
                  isCurrent={audio.current?.mount === mount.name}
                  isPlaying={audio.playing}
                  onPlay={handlePlay}
                />
              ))}
            </div>
          )}
        </div>
      </Layout>
      <MiniPlayer />
    </>
  )
}
