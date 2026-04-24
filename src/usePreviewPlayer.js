import { useState, useRef, useCallback } from "react";

export function usePreviewPlayer() {
  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const sourcesRef = useRef([]);
  const ctxRef = useRef(null);
  const timersRef = useRef([]);

  const stop = useCallback(() => {
    sourcesRef.current.forEach((s) => { try { s.stop(0); } catch {} });
    sourcesRef.current = [];
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setPlaying(false);
    setActiveIndex(-1);
  }, []);

  // startIndex: which item in `segments` to begin from
  const play = useCallback((audioBuffer, segments, startIndex = 0) => {
    if (!audioBuffer || segments.length === 0) return;
    stop();

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const toPlay = segments.slice(startIndex);
    let scheduleAt = ctx.currentTime + 0.05;
    const sources = [];
    const durations = [];

    for (const seg of toPlay) {
      const dur = Math.max(0, seg.end - seg.start);
      if (dur === 0) { durations.push(0); continue; }
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);
      src.start(scheduleAt, seg.start, dur);
      scheduleAt += dur;
      sources.push(src);
      durations.push(dur);
    }

    sourcesRef.current = sources;
    setPlaying(true);
    setActiveIndex(startIndex);

    // Schedule per-segment active index updates
    let elapsed = 0;
    const timers = [];
    toPlay.forEach((_, i) => {
      const t = setTimeout(() => setActiveIndex(startIndex + i), elapsed * 1000 + 50);
      timers.push(t);
      elapsed += durations[i];
    });

    const totalMs = elapsed * 1000;
    const endTimer = setTimeout(() => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      setPlaying(false);
      setActiveIndex(-1);
    }, totalMs + 300);

    timersRef.current = [...timers, endTimer];
  }, [stop]);

  return { play, stop, playing, activeIndex };
}
