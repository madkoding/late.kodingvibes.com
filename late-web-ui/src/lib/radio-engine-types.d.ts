// Mirror of late-micro-radio/src/global.ts. Kept in this repo (the shell)
// so we can type-check the consumer side without depending on the micro's
// bundle. The runtime contract is window.RadioEngine (see lib/radio-engine.ts).
//
// The single source of truth for these types is late-micro-radio. If the
// contract changes there, update this file too.

export type StreamInfo = {
  name: string;
  url: string;
  mount: string;
  artist?: string;
  title?: string;
  category?: string;
  emoji?: string;
  accent?: string;
};

export type TrackMeta = {
  artist: string | null;
  title: string | null;
  raw: string | null;
};

export type RadioState = {
  current: StreamInfo | null;
  track: TrackMeta | null;
  playing: boolean;
  loading: boolean;
  volume: number;
  muted: boolean;
};

export interface RadioEngine {
  version: string;
  streams: readonly StreamInfo[];
  getState(): RadioState;
  subscribe(fn: (s: RadioState) => void): () => void;
  play(s: StreamInfo): void;
  toggle(): void;
  stop(): void;
  setVolume(v: number): void;
  toggleMute(): void;
  getAudioElement(): HTMLAudioElement | null;
  getAnalyser(): AnalyserNode | null;
}
