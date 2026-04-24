export const LABELS = [
  { id: "intro",   name: "イントロ", color: "#818cf8" },
  { id: "verseA",  name: "Aメロ",   color: "#60a5fa" },
  { id: "verseB",  name: "Bメロ",   color: "#34d399" },
  { id: "chorus",  name: "サビ",    color: "#f87171" },
  { id: "bridge",  name: "ブリッジ", color: "#fbbf24" },
  { id: "outro",   name: "アウトロ", color: "#a78bfa" },
  { id: "A",       name: "A",       color: "#22d3ee" },
  { id: "B",       name: "B",       color: "#f472b6" },
  { id: "C",       name: "C",       color: "#fb923c" },
  { id: "D",       name: "D",       color: "#a3e635" },
];

export function getLabelById(id) {
  return LABELS.find((l) => l.id === id) ?? { id, name: id || "—", color: "#475569" };
}

// hex + alpha suffix: active regions are more opaque
export function regionColor(labelId, active = false) {
  return getLabelById(labelId).color + (active ? "bb" : "33");
}
