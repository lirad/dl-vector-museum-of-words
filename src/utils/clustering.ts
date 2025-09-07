// KMeans-lite (few iterations) for playful cluster colors
export function kmeans(points: number[][], k = 4, iters = 10) {
  if (points.length === 0) return { labels: [] as number[], centers: [] as number[][] };
  const n = points.length;
  const centers: number[][] = [];
  for (let i = 0; i < k && i < n; i++) centers.push([...points[i]]);
  const labels = new Array(n).fill(0);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      let best = 0, bestd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dx = points[i][0] - centers[c][0];
        const dy = points[i][1] - centers[c][1];
        const d = dx * dx + dy * dy;
        if (d < bestd) { bestd = d; best = c; }
      }
      labels[i] = best;
    }
    const sum = centers.map(() => [0, 0]);
    const cnt = centers.map(() => 0);
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      sum[c][0] += points[i][0];
      sum[c][1] += points[i][1];
      cnt[c] += 1;
    }
    for (let c = 0; c < centers.length; c++) {
      if (cnt[c] > 0) {
        centers[c][0] = sum[c][0] / cnt[c];
        centers[c][1] = sum[c][1] / cnt[c];
      }
    }
  }
  return { labels, centers };
}

// Scale 2D coords to the viewport with padding
export function normalize2D(coords: number[][], width: number, height: number, pad = 40) {
  if (coords.length === 0) return [] as number[][];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const W = width - pad * 2;
  const H = height - pad * 2;
  return coords.map(([x, y]) => [
    pad + ((x - minX) / spanX) * W,
    pad + ((y - minY) / spanY) * H,
  ]);
}