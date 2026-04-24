/**
 * Encode an ordered list of AudioBuffer segments to WAV.
 *
 * Key design decisions:
 *  - Channel data is fetched ONCE before the loop (not on every sample)
 *  - PCM is written to Int16Array (much faster than DataView.setInt16 in a tight loop)
 *  - Header and PCM are passed as separate parts to the Blob constructor
 *    → avoids allocating one giant merged ArrayBuffer
 */
export function encodeWav(audioBuffer, segments) {
  const sampleRate  = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;

  console.log("[exportWav] start", {
    sampleRate,
    numChannels,
    bufferLength: audioBuffer.length,
    segments: segments.map((s) => ({
      start: s.start.toFixed(2),
      end:   s.end.toFixed(2),
    })),
  });

  // ── Pre-fetch Float32Array references (OUTSIDE the loop) ──────────
  // getChannelData() is cheap but calling it millions of times adds up.
  const channels = Array.from({ length: numChannels }, (_, ch) =>
    audioBuffer.getChannelData(ch)
  );
  console.log("[exportWav] channel data fetched");

  // ── Calculate total sample count ───────────────────────────────────
  const totalSamples = segments.reduce((sum, seg) => {
    const n = Math.max(0, Math.floor((seg.end - seg.start) * sampleRate));
    console.log(`[exportWav]   seg ${seg.start.toFixed(2)}→${seg.end.toFixed(2)}: ${n} samples`);
    return sum + n;
  }, 0);

  const dataBytes = totalSamples * numChannels * 2; // 16-bit = 2 bytes
  console.log("[exportWav] totalSamples:", totalSamples,
              "dataBytes:", dataBytes,
              `(${(dataBytes / 1024 / 1024).toFixed(1)} MB)`);

  // ── WAV header (44 bytes) ──────────────────────────────────────────
  const header = new ArrayBuffer(44);
  const dv     = new DataView(header);
  const str    = (off, s) =>
    [...s].forEach((c, i) => dv.setUint8(off + i, c.charCodeAt(0)));

  str(0,  "RIFF");
  dv.setUint32( 4, 36 + dataBytes,              true);
  str(8,  "WAVE");
  str(12, "fmt ");
  dv.setUint32(16, 16,                          true); // sub-chunk size
  dv.setUint16(20, 1,                           true); // PCM
  dv.setUint16(22, numChannels,                 true);
  dv.setUint32(24, sampleRate,                  true);
  dv.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  dv.setUint16(32, numChannels * 2,             true); // block align
  dv.setUint16(34, 16,                          true); // bits per sample
  str(36, "data");
  dv.setUint32(40, dataBytes,                   true);
  console.log("[exportWav] header written");

  // ── PCM encoding via Int16Array (significantly faster than DataView in a loop) ──
  const pcm = new Int16Array(totalSamples * numChannels);
  let pos = 0;

  for (const seg of segments) {
    const startSample = Math.floor(seg.start * sampleRate);
    const endSample   = Math.min(Math.floor(seg.end * sampleRate), audioBuffer.length);
    for (let i = startSample; i < endSample; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        // clamp to [-1, 1], then scale to signed 16-bit integer range
        const s = channels[ch][i];
        pcm[pos++] = (s > 1 ? 1 : s < -1 ? -1 : s) * 0x7FFF;
      }
    }
  }

  console.log("[exportWav] PCM encoded, samples written:", pos);
  return { header, pcm };
}

/**
 * Trigger a browser download of the encoded WAV data.
 * Accepts the object returned by encodeWav().
 */
export function downloadWav({ header, pcm }, filename = "edited.wav") {
  console.log("[exportWav] creating Blob", filename);

  // Pass header and PCM buffer as separate Blob parts — no large copy needed
  const blob = new Blob([header, pcm.buffer], { type: "audio/wav" });
  console.log("[exportWav] Blob created, size:", blob.size, "bytes",
              `(${(blob.size / 1024 / 1024).toFixed(1)} MB)`);

  const url = URL.createObjectURL(blob);
  console.log("[exportWav] objectURL created:", url);

  const a = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.log("[exportWav] download link clicked");

  // IMPORTANT: revoke AFTER the browser has had time to start the download.
  // Revoking synchronously after click() causes an empty file in most browsers.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    console.log("[exportWav] objectURL revoked");
  }, 10_000);
}
