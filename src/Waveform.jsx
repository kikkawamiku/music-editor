import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { getLabelById, regionColor } from "./labels";

function fmt(t) {
  const m = Math.floor(t / 60).toString().padStart(2, "0");
  const s = (t % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

// Returns a styled HTMLElement for the region label.
// Passing HTMLElement (not string) gives full CSS control and avoids clipping.
function makeLabel(name, color) {
  const el = document.createElement("span");
  el.textContent = name;
  Object.assign(el.style, {
    display:       "inline-block",
    fontSize:      "11px",
    fontWeight:    "700",
    lineHeight:    "1.4",
    color,
    background:    "rgba(6,13,24,0.88)",
    padding:       "2px 7px",
    borderRadius:  "4px",
    border:        `1px solid ${color}55`,
    whiteSpace:    "nowrap",
    pointerEvents: "none",
    userSelect:    "none",
  });
  return el;
}

const Waveform = forwardRef(function Waveform(
  { audioUrl, segments, onRegionUpdate, onPlayStateChange },
  ref
) {
  const containerRef = useRef(null);
  const wsRef        = useRef(null);
  const regionsRef   = useRef(null);
  const segmentsRef  = useRef(segments);
  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);

  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => wsRef.current?.getCurrentTime() ?? 0,
    isPlaying:      () => wsRef.current?.isPlaying() ?? false,
    playPause:      () => wsRef.current?.playPause(),
  }), []);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     "#1e3a5f",
      progressColor: "#3b82f6",
      cursorColor:   "#60a5fa",
      cursorWidth:   2,
      height:        110,
      barWidth:      2,
      barGap:        1,
      barRadius:     2,
      plugins:       [regions],
    });
    wsRef.current = ws;
    ws.load(audioUrl);

    ws.on("ready",  () => setDuration(ws.getDuration()));
    ws.on("play",   () => { setPlaying(true);  onPlayStateChange?.(true);  });
    ws.on("pause",  () => { setPlaying(false); onPlayStateChange?.(false); });
    ws.on("finish", () => { setPlaying(false); onPlayStateChange?.(false); });

    ws.on("audioprocess", (t) => {
      setCurrentTime(t);
      const segs = segmentsRef.current;
      regions.getRegions().forEach((r) => {
        const seg = segs.find((s) => String(s.id) === r.id);
        if (!seg) return;
        r.setOptions({ color: regionColor(seg.label, seg.start <= t && t < seg.end) });
      });
    });

    regions.on("region-updated", (r) =>
      onRegionUpdate?.(Number(r.id), r.start, r.end)
    );

    return () => ws.destroy();
  }, [audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions) return;
    regions.clearRegions();
    segments.forEach((s) => {
      const label = getLabelById(s.label);
      regions.addRegion({
        id:      String(s.id),
        start:   s.start,
        end:     s.end,
        color:   regionColor(s.label),
        drag:    false,
        resize:  true,
        content: s.label ? makeLabel(label.name, label.color) : "",
      });
    });
  }, [segments]);

  return (
    <div className="waveform-wrapper">
      <div ref={containerRef} className="waveform-canvas" />
      {audioUrl && (
        <div className="waveform-footer">
          <button
            className={`transport-play-btn ${playing ? "is-playing" : ""}`}
            onClick={() => wsRef.current?.playPause()}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <span className="transport-time">
            <span className="t-now">{fmt(currentTime)}</span>
            <span className="t-sep">/</span>
            <span className="t-total">{fmt(duration)}</span>
          </span>
        </div>
      )}
    </div>
  );
});

export default Waveform;
