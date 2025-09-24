// ---------- Seed the gallery with some exhibits ----------
export const SEED_WORDS = [
  "art", "museum", "gallery", "painting", "sculpture", "canvas", "frame", "curator",
  "music", "melody", "rhythm", "violin", "piano", 
  "dog", "cat", "wolf", "tiger", "bird", "whale",
  "apple", "banana", "orange", "grape", "lemon",
  "car", "bicycle", "train", "engine", "bridge",
  "city", "street", "plaza", "tower", "park",
  "code", "algorithm", "vector", "matrix", "search", "cluster",
  "love", "joy", "sadness", "anger", "calm",
  "ocean", "beach", "mountain", "forest", "desert",
  "space", "planet", "star", "galaxy", "moon"
];

// Semantic presets for different types of relationships
export const SEMANTIC_PRESETS = {
  "Queens & Kings": {
    description: "Famous queens, kings, and royalty across different domains",
    words: ["Queen", "Queen Elizabeth", "King Charles", "Michael Jackson", "Pelé", "Elvis Presley", "Freddie Mercury", "crown", "throne", "royalty", "legend", "icon", "monarch", "kingdom"]
  },
  "Cultural Icons": {
    description: "Mix of legendary people, artworks, and cultural phenomena",
    words: ["Beatles", "Einstein", "Shakespeare", "Mona Lisa", "Mozart", "Leonardo da Vinci", "Beethoven", "Picasso", "genius", "masterpiece", "famous", "legendary", "classic", "timeless"]
  },
  "Same Word, Different Worlds": {
    description: "Words with fascinating multiple meanings across contexts",
    words: ["bank", "bat", "rock", "spring", "mouse", "turkey", "bark", "duck", "bear", "club", "bank account", "baseball bat", "rock music", "mouse computer"]
  },
  "Tech vs Nature": {
    description: "Digital concepts that share names with natural phenomena",
    words: ["cloud", "stream", "web", "python", "apple", "blackberry", "firefox", "safari", "windows", "thunder", "lightning", "storm", "river", "forest"]
  },
  "Colors & Emotions": {
    description: "How colors connect to feelings and cultural meanings",
    words: ["red", "blue", "green", "yellow", "purple", "black", "white", "gold", "love", "sadness", "envy", "happiness", "royalty", "mourning", "purity", "wealth"]
  },
  "Time & Space": {
    description: "Temporal and spatial concepts and their relationships",
    words: ["yesterday", "tomorrow", "future", "past", "present", "here", "there", "everywhere", "nowhere", "always", "never", "sometimes", "distance", "closeness"]
  }
};

// Nice palette for cluster suggestions
export const PALETTE = [
  "#6366f1", "#22c55e", "#ef4444", "#eab308", "#06b6d4", "#a855f7", "#f97316"
];

// Soft color scale (0..1 -> HSL string)
export function heatColor(v: number) {
  const hue = 220 - 220 * v;
  const sat = 70;
  const light = 35 + 25 * v;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

// Text/placard metrics and fitting
export function labelMetrics(str: string, opts?: { minW?: number; maxW?: number; padX?: number; baseSize?: number; minSize?: number }) {
  const minW = opts?.minW ?? 72;
  const maxW = opts?.maxW ?? 300;
  const padX = opts?.padX ?? 12;
  let fontSize = opts?.baseSize ?? 12; // px
  const minSize = opts?.minSize ?? 10;
  const charW = (size: number) => size * 0.6; // rough estimate
  const estWidth = (s: string, fs: number) => Math.max(minW - padX * 2, Math.min(maxW - padX * 2, s.length * charW(fs)));
  let w = Math.min(maxW, Math.max(minW, estWidth(str, fontSize) + padX * 2));
  while (estWidth(str, fontSize) > w - padX * 2 && fontSize > minSize) fontSize -= 1;
  let text = str;
  const maxChars = Math.floor((w - padX * 2) / charW(fontSize));
  if (str.length > maxChars) text = str.slice(0, Math.max(0, maxChars - 1)) + "…";
  return { width: w, height: 44, fontSize, text, padX } as const;
}