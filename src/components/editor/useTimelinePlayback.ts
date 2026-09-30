"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EditorClip } from "./ClipTrimmer";
import { clipStarts, musicLength, musicVolumeAt, timelineLength, type MusicTrack } from "./timeline-model";

// Plays the timeline as one video: a single <video> steps through the clips' kept parts in order
// while an <audio> element plays the music at its offset. `time` is the position on the whole
// timeline, so the timeline's playhead, the ruler and the preview all share one clock.
export function useTimelinePlayback(clips: EditorClip[], music: MusicTrack | null) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const starts = useMemo(() => clipStarts(clips), [clips]);
  const total = useMemo(() => timelineLength(clips), [clips]);

  // Mutable playback state read inside rAF/media callbacks.
  const seg = useRef(0);
  const wantPlay = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const timeRef = useRef(0);
  const latest = useRef({ clips, starts, total, music });
  // Keep the callbacks (rAF loop, media events) reading the current timeline. A layout effect runs
  // before the browser paints and before the other effects below, so they see fresh values.
  useLayoutEffect(() => {
    latest.current = { clips, starts, total, music };
  }, [clips, starts, total, music]);

  const locate = useCallback((t: number) => {
    const { clips, starts, total } = latest.current;
    const clamped = Math.max(0, Math.min(t, total));
    let i = 0;
    for (let k = clips.length - 1; k >= 0; k--) {
      if (clamped >= starts[k]) {
        i = k;
        break;
      }
    }
    const clip = clips[i];
    const local = clip ? Math.min(clip.trimStart + (clamped - starts[i]), clip.trimEnd) : 0;
    return { i, local, clamped };
  }, []);

  const loadSegment = useCallback((i: number, local: number) => {
    const v = videoRef.current;
    const clip = latest.current.clips[i];
    if (!v || !clip) return;
    seg.current = i;
    if (v.getAttribute("src") !== clip.sourceUrl) {
      // New file: seek once its metadata has loaded (see onLoadedMetadata).
      pendingSeek.current = local;
      v.src = clip.sourceUrl;
      v.load();
    } else {
      pendingSeek.current = null;
      v.currentTime = local;
      if (wantPlay.current) v.play().catch(() => {});
    }
  }, []);

  const syncAudio = useCallback((t: number, force = false) => {
    const a = audioRef.current;
    const { music, total } = latest.current;
    if (!a || !music) return;
    const rel = t - music.offset;
    const inRange = rel >= 0 && rel < musicLength(music, total);
    const desired = music.trimStart + Math.max(0, rel);
    a.volume = inRange ? musicVolumeAt(music, total, t) : 0;
    if (inRange && wantPlay.current) {
      if (force || Math.abs(a.currentTime - desired) > 0.25) a.currentTime = desired;
      if (a.paused) a.play().catch(() => {});
    } else {
      if (!a.paused) a.pause();
      if (force) a.currentTime = desired;
    }
  }, []);

  const seek = useCallback(
    (t: number) => {
      const { i, local, clamped } = locate(t);
      timeRef.current = clamped;
      setTime(clamped);
      loadSegment(i, local);
      syncAudio(clamped, true);
    },
    [locate, loadSegment, syncAudio]
  );

  const pause = useCallback(() => {
    wantPlay.current = false;
    setPlaying(false);
    videoRef.current?.pause();
    audioRef.current?.pause();
  }, []);

  const play = useCallback(() => {
    if (!latest.current.clips.length) return;
    wantPlay.current = true;
    setPlaying(true);
    // At the end: start over.
    const from = timeRef.current >= latest.current.total - 0.05 ? 0 : timeRef.current;
    seek(from);
  }, [seek]);

  // Follow the video while playing; step to the next clip at each clip's trim end.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const v = videoRef.current;
      const { clips, starts, total } = latest.current;
      const clip = clips[seg.current];
      if (!v || !clip) return;
      if (pendingSeek.current === null) {
        if (v.currentTime >= clip.trimEnd - 0.02) {
          const next = seg.current + 1;
          if (next < clips.length) {
            loadSegment(next, clips[next].trimStart);
          } else {
            timeRef.current = total;
            setTime(total);
            pause();
            return;
          }
        } else {
          const t = Math.min(total, starts[seg.current] + (v.currentTime - clip.trimStart));
          timeRef.current = t;
          setTime(t);
          syncAudio(t);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, loadSegment, pause, syncAudio]);

  // Edits (trim, reorder, delete, music changes) while paused: show the frame at the playhead.
  useEffect(() => {
    if (wantPlay.current) return;
    const { i, local, clamped } = locate(timeRef.current);
    timeRef.current = clamped;
    loadSegment(i, local);
    syncAudio(clamped, true);
  }, [clips, music, locate, loadSegment, syncAudio]);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v || pendingSeek.current === null) return;
    v.currentTime = pendingSeek.current;
    pendingSeek.current = null;
    if (wantPlay.current) v.play().catch(() => {});
  }, []);

  return {
    videoRef,
    audioRef,
    onLoadedMetadata,
    time: Math.min(time, total),
    total,
    playing,
    play,
    pause,
    seek,
  };
}
