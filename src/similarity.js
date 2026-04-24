import Meyda from "meyda";

const BUFFER_SIZE = 2048;
const HOP_SIZE = 512;

// Mean of a 2D array along the time axis
function timeMean(vectors) {
  return vectors[0].map((_, i) =>
    vectors.reduce((s, v) => s + v[i], 0) / vectors.length
  );
}

// L2-normalize a vector so cosine similarity is a pure dot product
function normalize(v) {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

function cosineSimilarity(a, b) {
  return a.reduce((s, x, i) => s + x * b[i], 0);
}

// Returns { mfcc: Float32Array, chroma: Float32Array } or null
export function extractFeatures(audioBuffer, startSec, endSec) {
  const { sampleRate } = audioBuffer;
  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.floor(endSec * sampleRate);
  const channelData = audioBuffer.getChannelData(0).slice(startSample, endSample);

  const mfccFrames = [];
  const chromaFrames = [];

  for (let i = 0; i + BUFFER_SIZE <= channelData.length; i += HOP_SIZE) {
    const frame = channelData.slice(i, i + BUFFER_SIZE);
    try {
      const mfcc = Meyda.extract("mfcc", frame);
      const chroma = Meyda.extract("chroma", frame);
      if (Array.isArray(mfcc) && Array.isArray(chroma)) {
        mfccFrames.push(mfcc);
        chromaFrames.push(chroma);
      }
    } catch {
      // skip frames Meyda cannot process (silence, edge cases)
    }
  }

  if (mfccFrames.length === 0) return null;

  return {
    mfcc: normalize(timeMean(mfccFrames)),
    chroma: normalize(timeMean(chromaFrames)),
  };
}

// Weighted similarity between two feature objects
// mfccWeight + chromaWeight should sum to 1.0, but any positive values work
export function computeSimilarity(featA, featB, mfccWeight = 0.6, chromaWeight = 0.4) {
  const mfccSim = cosineSimilarity(featA.mfcc, featB.mfcc);
  const chromaSim = cosineSimilarity(featA.chroma, featB.chroma);
  const total = mfccWeight + chromaWeight;
  return (mfccSim * mfccWeight + chromaSim * chromaWeight) / total;
}

// Assign A/B/C... labels based on weighted similarity
// threshold: minimum similarity to be considered the same phrase (0–1)
export function assignLabels(
  featuresArray,
  { threshold = 0.97, mfccWeight = 0.6, chromaWeight = 0.4 } = {}
) {
  const labels = new Array(featuresArray.length).fill(null);
  const prototypes = []; // [{ label, feature }] — one representative per group
  let nextCode = 0;

  for (let i = 0; i < featuresArray.length; i++) {
    if (!featuresArray[i]) {
      labels[i] = "?";
      continue;
    }

    let bestLabel = null;
    let bestSim = -Infinity;

    for (const { label, feature } of prototypes) {
      const sim = computeSimilarity(featuresArray[i], feature, mfccWeight, chromaWeight);
      if (sim > bestSim) {
        bestSim = sim;
        bestLabel = label;
      }
    }

    if (bestSim >= threshold) {
      labels[i] = bestLabel;
    } else {
      const newLabel = String.fromCharCode(65 + (nextCode % 26));
      nextCode++;
      labels[i] = newLabel;
      prototypes.push({ label: newLabel, feature: featuresArray[i] });
    }
  }

  return labels;
}
