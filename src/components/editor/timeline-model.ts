import type { EditorClip } from "./ClipTrimmer";

// Background music on its own track. `url` is a local blob: URL of the chosen file.
export interface MusicTrack {
  url: string;
  name: string;
  // Length of the song file, in seconds.
  duration: number;
  // Where on the video timeline the music starts.
  offset: number;
  // How far into the song to start playing from (skip an intro).
  trimStart: number;
  // 0..1
  volume: number;
  fadeOut: boolean;
}

// Length of the fade at the end of the music, and the short fade-in that avoids a click.
export const MUSIC_FADE_OUT = 2;
export const MUSIC_FADE_IN = 0.3;

export function clipLength(clip: EditorClip) {
  return clip.trimEnd - clip.trimStart;
}

export function timelineLength(clips: EditorClip[]) {
  return clips.reduce((sum, c) => sum + clipLength(c), 0);
}

// Start time of each clip on the timeline.
export function clipStarts(clips: EditorClip[]) {
  let at = 0;
  return clips.map((c) => {
    const start = at;
    at += clipLength(c);
    return start;
  });
}

// How long the music actually plays: until the song runs out or the video ends.
export function musicLength(music: MusicTrack, total: number) {
  return Math.max(0, Math.min(music.duration - music.trimStart, total - music.offset));
}

// Music volume at timeline time `t`, including fade-in/out. 0 outside the music block.
export function musicVolumeAt(music: MusicTrack, total: number, t: number) {
  const len = musicLength(music, total);
  const rel = t - music.offset;
  if (rel < 0 || rel >= len) return 0;
  const fadeIn = Math.min(1, rel / MUSIC_FADE_IN);
  const fadeLen = Math.min(MUSIC_FADE_OUT, len);
  const fadeOut = music.fadeOut ? Math.min(1, (len - rel) / fadeLen) : 1;
  return Math.max(0, Math.min(1, music.volume * fadeIn * fadeOut));
}
