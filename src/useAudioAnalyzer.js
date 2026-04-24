import { useState, useRef, useCallback } from "react";

const MIN_SPLIT_SEC = 0.3;

export function useAudioAnalyzer() {
  const [segments, setSegments] = useState([]);
  const idCounter = useRef(0);

  const initAudio = useCallback((duration) => {
    idCounter.current = 0;
    setSegments([{ id: idCounter.current++, start: 0, end: duration, label: "" }]);
  }, []);

  const splitAt = useCallback((time) => {
    setSegments((prev) => {
      const target = prev.find((s) => s.start < time && time < s.end);
      if (!target) return prev;
      if (time - target.start < MIN_SPLIT_SEC) return prev;
      if (target.end   - time < MIN_SPLIT_SEC) return prev;
      const newId = idCounter.current++;
      return [
        ...prev.filter((s) => s.id !== target.id),
        { ...target, end: time },
        { id: newId, start: time, end: target.end, label: target.label },
      ].sort((a, b) => a.start - b.start);
    });
  }, []);

  // Merge deleted region into its predecessor (or successor if first)
  const deleteSegment = useCallback((id) => {
    setSegments((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const target = prev[idx];
      const rest   = prev.filter((s) => s.id !== id);
      if (idx > 0) {
        const prevId = prev[idx - 1].id;
        return rest.map((s) => (s.id === prevId ? { ...s, end: target.end } : s));
      }
      const nextId = prev[1].id;
      return rest.map((s) => (s.id === nextId ? { ...s, start: target.start } : s));
    });
  }, []);

  // Restore from draft — syncs idCounter so future splits get unique IDs
  const loadSegments = useCallback((segs) => {
    const maxId = segs.reduce((m, s) => Math.max(m, s.id), -1);
    idCounter.current = maxId + 1;
    setSegments([...segs]);
  }, []);

  const bpmSplit = useCallback((bpm, duration, offset = 0) => {
    const phraseLen = (32 * 60) / bpm;
    const effective = duration - offset;
    const count     = Math.floor(effective / phraseLen);
    idCounter.current = 0;
    const segs = [];
    for (let i = 0; i < count; i++) {
      segs.push({
        id: idCounter.current++,
        start: offset + i * phraseLen,
        end: Math.min(offset + (i + 1) * phraseLen, duration),
        label: "",
      });
    }
    if (effective - count * phraseLen > phraseLen * 0.5) {
      segs.push({ id: idCounter.current++, start: offset + count * phraseLen, end: duration, label: "" });
    }
    setSegments(segs);
  }, []);

  const updateLabel = useCallback((id, label) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  }, []);

  const updateSegmentBounds = useCallback((id, start, end) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, start, end } : s)));
  }, []);

  return {
    segments,
    initAudio,
    splitAt,
    deleteSegment,
    loadSegments,
    bpmSplit,
    updateLabel,
    updateSegmentBounds,
  };
}
