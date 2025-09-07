// Utility functions for embeddings and vector operations

// ---------- Utility: tiny embedding (char trigrams -> hashed bag-of-ngrams) ----------
function hashTri(tri: string) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < tri.length; i++) {
    h ^= tri.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function embedWordToy(word: string, dim = 128): Float32Array {
  const s = `^^${word.toLowerCase()}$$`;
  const v = new Float32Array(dim);
  for (let i = 0; i < s.length - 2; i++) {
    const tri = s.slice(i, i + 3);
    const idx = hashTri(tri) % dim;
    v[idx] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

export function dot(a: Float32Array | number[], b: Float32Array | number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a as any)[i] * (b as any)[i];
  return s;
}

export function cosine(a: Float32Array, b: Float32Array) {
  return dot(a, b); // already normalized
}

// Build similarity matrix (0..1)
export function buildSimMatrix(vectors: Float32Array[]) {
  const n = vectors.length;
  const M: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const s = (cosine(vectors[i], vectors[j]) + 1) / 2; // map -1..1 to 0..1
      M[i][j] = s; M[j][i] = s;
    }
  }
  return M;
}

export function nearestNeighbors(vectors: Float32Array[], k = 2) {
  const n = vectors.length;
  const result: { j: number; s: number }[][] = [];
  for (let i = 0; i < n; i++) {
    const sims: { j: number; s: number }[] = [];
    for (let j = 0; j < n; j++) if (j !== i) sims.push({ j, s: cosine(vectors[i], vectors[j]) });
    sims.sort((a, b) => b.s - a.s);
    result.push(sims.slice(0, k));
  }
  return result; // array of arrays of {j, s}
}