import { useMemo } from "react";
import { buildSimMatrix } from "../utils/embeddings";
import { heatColor } from "../utils/constants";

export function Heatmap({ words, vectors, dark }: { words: string[]; vectors: Float32Array[]; dark: boolean }) {
  const M = useMemo(() => buildSimMatrix(vectors), [vectors]);
  const size = 22; // cell size
  const n = words.length;
  const w = size * n;
  const h = size * n + 24; // leave room for labels

  return (
    <svg width={Math.max(360, w + 140)} height={Math.max(200, h + 120)} className="block">
      {words.map((wrd, i) => (<text key={`r-${i}`} x={0} y={60 + i * size + size * 0.7} fontSize={11} fill={dark ? "#e5e7eb" : "#111827"}>{wrd}</text>))}
      {words.map((wrd, j) => (<text key={`c-${j}`} x={80 + j * size + size * 0.5} y={40} fontSize={11} fill={dark ? "#e5e7eb" : "#111827"} transform={`rotate(-45, ${80 + j * size + size * 0.5}, 40)`}>{wrd}</text>))}
      <g transform="translate(80, 50)">
        {M.map((row, i) => row.map((v, j) => (
          <g key={`cell-${i}-${j}`}>
            <title>{`${words[i]} × ${words[j]}: ${v.toFixed(2)}`}</title>
            <rect x={j * size} y={i * size} width={size - 1} height={size - 1} fill={heatColor(v)} rx={3} />
          </g>
        )))}
      </g>
      <g transform={`translate(80, ${h + 60})`}>
        <text x={0} y={0} fontSize={11} fill={dark ? "#e5e7eb" : "#111827"}>Similarity</text>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <g key={i} transform={`translate(${60 + i * 80}, -12)`}>
            <rect width={70} height={12} fill={heatColor(t)} rx={3} />
            <text x={35} y={28} textAnchor="middle" fontSize={11} fill={dark ? "#e5e7eb" : "#111827"}>{t.toFixed(2)}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}