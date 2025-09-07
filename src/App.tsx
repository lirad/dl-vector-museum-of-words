import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UMAP } from "umap-js";
import { PCA } from "ml-pca";
import { PlusCircle, Sun, MoonStar, Grid3X3, Map, HelpCircle, Search, Cpu } from "lucide-react";

import { WallBackground } from "./components/WallBackground";
import { HelpModal } from "./components/HelpModal";
import { Heatmap } from "./components/Heatmap";
import { embedWordToy, dot, nearestNeighbors } from "./utils/embeddings";
import { kmeans, normalize2D } from "./utils/clustering";
import { SEED_WORDS, PALETTE, labelMetrics } from "./utils/constants";
import type { RealStoreEntry } from "./types";

// ---------------------------------------------
// Museum of Words — Interactive Vector Matrix
// ---------------------------------------------
// New in this update
// • Real embeddings option powered by a small on‑device model (MiniLM-L6‑v2 via @xenova/transformers).
// • Token view: see BPE tokens and IDs for the selected phrase.
// • Clear engine switch (Toy vs Real), model loader UI, and safer fallbacks.
// • Kept UMAP/PCA, neighbors, heatmap, spotlight, and self‑tests.
// ---------------------------------------------

export default function MuseumOfWords() {
  const [words, setWords] = useState<string[]>(() => SEED_WORDS.slice(0, 16));
  const [newWord, setNewWord] = useState("");
  const [method, setMethod] = useState<"umap" | "pca">("umap");
  const [dark, setDark] = useState(true);
  const [live, setLive] = useState(false);
  const [neighbors, setNeighbors] = useState(2);
  const [dim, setDim] = useState(128); // used in Toy engine only
  const [umapMinDist, setUmapMinDist] = useState(0.15);
  const [umapNNeighbors, setUmapNNeighbors] = useState(12);
  const [tab, setTab] = useState<"gallery" | "matrix">("gallery");
  const [simple, setSimple] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [testNote, setTestNote] = useState<string>("");
  const [query, setQuery] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [engine, setEngine] = useState<"toy" | "minilm">("minilm");

  // Real model loader state
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [extractor, setExtractor] = useState<any>(null);
  const [tokenizer, setTokenizer] = useState<any>(null);
  const [realStore, setRealStore] = useState<Record<string, RealStoreEntry>>({});

  // Auto-curation: drip new words while in "live" mode
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const pool = SEED_WORDS.filter(w => !words.includes(w));
      if (pool.length === 0) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      setWords(w => (w.includes(pick) ? w : [...w, pick]));
    }, 1400);
    return () => clearInterval(id);
  }, [live, words]);

  // Ensure model when engine is real
  useEffect(() => {
    if (engine !== "minilm" || extractor) return;
    (async () => {
      try {
        setLoadingModel(true);
        const t = await import("@xenova/transformers");
        // cache in browser to avoid re-downloading
        (t as any).env.useBrowserCache = true;
        (t as any).env.allowLocalModels = false;
        const pipe = await (t as any).pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true });
        const tok = await (t as any).AutoTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
        setExtractor(pipe);
        setTokenizer(tok);
        setModelError(null);
      } catch (e: any) {
        setModelError("Failed to load MiniLM model. Falling back to Toy embeddings.");
        setEngine("toy");
      } finally {
        setLoadingModel(false);
      }
    })();
  }, [engine, extractor]);

  // Compute/capture real embeddings for any words missing
  useEffect(() => {
    if (engine !== "minilm" || !extractor || !tokenizer) return;
    let cancelled = false;
    (async () => {
      for (const w of words) {
        if (cancelled) return;
        if (realStore[w]) continue;
        try {
          const out = await extractor(w, { pooling: "mean", normalize: true });
          const vec = new Float32Array(out.data as number[]);
          const enc = await tokenizer.encode(w);
          const tokens: string[] = (enc as any).tokens ?? (enc as any).tokens ?? [];
          const tokenIds: number[] = (enc as any).ids ?? (enc as any).input_ids ?? [];
          if (cancelled) return;
          setRealStore(prev => ({ ...prev, [w]: { vec, tokens, tokenIds } }));
        } catch (e) {
          // ignore single failure; leave it to Toy embedding via fallback
        }
      }
    })();
    return () => { cancelled = true; };
  }, [engine, extractor, tokenizer, words, realStore]);

  // Compute embeddings (vector list) based on engine; fallback gracefully
  const vectors = useMemo(() => {
    if (engine === "minilm") {
      return words.map(w => realStore[w]?.vec ?? embedWordToy(w, 256));
    } else {
      return words.map(w => embedWordToy(w, dim));
    }
  }, [words, engine, realStore, dim]);

  // 2D projection
  const coordsRaw = useMemo(() => {
    if (words.length === 0) return [] as number[][];
    const X = vectors.map(v => Array.from(v));
    if (X.length < 3) return X.map((_v, i) => [i * 30, i * 30]);
    try {
      if (method === "pca") {
        const pca = new PCA(X);
        const Y = pca.predict(X, { nComponents: 2 }).to2DArray();
        return Y;
      } else {
        const umap = new UMAP({ nNeighbors: Math.max(2, Math.min(umapNNeighbors, X.length - 1)), minDist: umapMinDist, nComponents: 2 });
        const Y = umap.fit(X);
        return Y as number[][];
      }
    } catch (e) {
      // fallback: random projections
      const seed = 1337;
      function rand(i: number) { const x = Math.sin(seed + i) * 10000; return x - Math.floor(x); }
      const d = X[0]?.length ?? 64;
      const a = Array.from({ length: d }, (_, i) => rand(i) - 0.5);
      const b = Array.from({ length: d }, (_, i) => rand(i + 17) - 0.5);
      return vectors.map(v => [dot(v, a), dot(v, b)]) as number[][];
    }
  }, [vectors, method, umapMinDist, umapNNeighbors, words.length]);

  const width = 980, height = 560;
  const coords = useMemo(() => normalize2D(coordsRaw, width, height, 50), [coordsRaw]);

  // Cluster coloring
  const { labels } = useMemo(
    () => kmeans(coords, Math.min(5, Math.max(2, Math.floor(Math.sqrt(Math.max(1, coords.length) / 3))))),
    [coords]
  );

  // Neighbor graph
  const neighborList = useMemo(() => nearestNeighbors(vectors, neighbors), [vectors, neighbors]);

  function addWord() {
    const w = newWord.trim();
    if (!w) return;
    if (words.map(s => s.toLowerCase()).includes(w.toLowerCase())) { setNewWord(""); setSelected(words.findIndex(x => x.toLowerCase() === w.toLowerCase())); return; }
    setWords([...words, w]);
    setSelected(words.length);
    setNewWord("");
  }

  function resetGallery() {
    setWords(SEED_WORDS.slice(0, 12));
    setSelected(null);
  }

  // Dev self-tests (toy, engine-agnostic where possible)
  useEffect(() => {
    const results: { name: string; pass: boolean }[] = [];
    function test(name: string, fn: () => boolean) { let pass = false; try { pass = !!fn(); } catch { pass = false; } results.push({ name, pass }); }
    const v1 = embedWordToy("Test", 64), v2 = embedWordToy("test", 64), v3 = embedWordToy("toast", 64);
    test("toy dimension", () => v1.length === 64);
    test("toy normalization", () => Math.abs(dot(v1, v1) - 1) < 1e-6);
    test("toy case-insensitive", () => Math.abs(dot(v1, v2) - 1) < 1e-6); // Fixed: use dot for normalized vectors
    test("toy cosine different < 1", () => dot(v1, v3) < 1); // Fixed: use dot for normalized vectors
    // eslint-disable-next-line no-console
    console.table(results);
    const failures = results.filter(r => !r.pass).length;
    setTestNote(failures === 0 ? "All self-tests passed" : `${failures} self-test(s) failed — open console`);
  }, []);

  // Spotlight helpers
  const selectedNeighbors = useMemo(() => {
    if (selected == null) return null;
    const arr = neighborList[selected] || [];
    return arr.map(({ j, s }) => ({ index: j, sim: s })).sort((a, b) => b.sim - a.sim);
  }, [neighborList, selected]);

  // Quick search/select
  useEffect(() => {
    if (!query) return;
    const i = words.findIndex(w => w.toLowerCase() === query.toLowerCase());
    if (i >= 0) setSelected(i);
  }, [query, words]);

  const center = { x: width / 2, y: height / 2 };

  return (
    <div className={`min-h-screen ${dark ? "text-zinc-100 bg-zinc-950" : "text-zinc-900 bg-zinc-100"} p-6 font-sans`}>
      <WallBackground dark={dark} />
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl px-3 py-1.5 bg-gradient-to-r from-pink-500/80 to-violet-500/80 text-white text-sm shadow">Museum of Words</div>
            <div className="hidden sm:flex items-center gap-2 text-sm opacity-80">
              <span>Add words & phrases → see clusters.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border px-3 py-2 text-sm backdrop-blur bg-white/5 border-white/10 hover:bg-white/10 transition" onClick={() => setDark(d => !d)} title={dark ? "Switch to Light" : "Switch to Dark"}>
              {dark ? <Sun size={16} /> : <MoonStar size={16} />}
            </button>
            <button className="rounded-xl border px-3 py-2 text-sm backdrop-blur bg-white/5 border-white/10 hover:bg-white/10 transition flex items-center gap-2" onClick={() => setHelpOpen(true)}>
              <HelpCircle size={16} /> Help
            </button>
          </div>
        </header>

        {/* Controls */}
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2 rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur">
            <div className="flex flex-wrap gap-2 items-center">
              <input value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === "Enter" && addWord()} placeholder="Type a word or phrase (e.g., vector search)" className="min-w-[260px] flex-1 rounded-xl px-3 py-2 bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400/50" />
              <button onClick={addWord} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-violet-500/90 hover:bg-violet-500 text-white shadow">
                <PlusCircle size={16} /> Hang it
              </button>

              {/* Engine switch */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs opacity-70">Engine</span>
                <div className="flex rounded-xl overflow-hidden border border-white/10 text-sm">
                  <button onClick={() => setEngine("toy")} className={`px-3 py-1.5 ${engine === "toy" ? "bg-white/20" : "bg-transparent"}`} title="Toy: hashed character trigrams (fast, local).">Toy</button>
                  <button onClick={() => setEngine("minilm")} className={`px-3 py-1.5 flex items-center gap-1 ${engine === "minilm" ? "bg-white/20" : "bg-transparent"}`} title="Real: MiniLM sentence embeddings on your device."><Cpu size={14}/> Real</button>
                </div>
              </div>
            </div>

            {engine === "minilm" && (
              <div className="mt-2 text-xs opacity-80">
                {loadingModel ? (
                  <span>Loading MiniLM model… first run downloads weights and caches them locally.</span>
                ) : modelError ? (
                  <span className="text-red-300">{modelError}</span>
                ) : (
                  <span>Using <span className="font-semibold">MiniLM-L6‑v2</span> sentence embeddings (dim ≈ 384). Tokens shown in the Spotlight.</span>
                )}
              </div>
            )}

            <div className="mt-3 grid sm:grid-cols-4 gap-3 text-sm">
              <div className="col-span-2 flex items-center gap-2">
                <span className="opacity-70">Projection</span>
                <div className="flex gap-1 rounded-xl overflow-hidden border border-white/10" title="UMAP preserves local neighborhoods; PCA preserves global axes of variance.">
                  <button onClick={() => setMethod("umap")} className={`px-3 py-1 ${method === "umap" ? "bg-white/20" : "bg-transparent"}`}><Map className="inline mr-1" size={14}/>UMAP</button>
                  <button onClick={() => setMethod("pca")} className={`px-3 py-1 ${method === "pca" ? "bg-white/20" : "bg-transparent"}`}><Grid3X3 className="inline mr-1" size={14}/>PCA</button>
                </div>
              </div>

              <label className="flex items-center gap-2" title="How many neighbor links per node to draw.">
                <span className="opacity-70">Links / node</span>
                <input type="range" min={1} max={5} value={neighbors} onChange={e => setNeighbors(parseInt(e.target.value))} />
                <span className="w-6 text-right">{neighbors}</span>
              </label>

              {engine === "toy" && (
                <label className="flex items-center gap-2" title="Embedding dimensions for the toy model. Higher can give crisper clusters.">
                  <span className="opacity-70">Toy dim</span>
                  <input type="range" min={64} max={256} step={32} value={dim} onChange={e => setDim(parseInt(e.target.value))} />
                  <span className="w-10 text-right">{dim}</span>
                </label>
              )}
            </div>

            {/* Advanced controls */}
            <div className="mt-3 flex items-center gap-3 text-sm">
              <button onClick={() => setSimple(s => !s)} className="rounded-xl px-3 py-1.5 border border-white/10 bg-white/10 hover:bg-white/20">
                {simple ? "Show advanced" : "Hide advanced"}
              </button>
              {!simple && (
                <div className="grid sm:grid-cols-2 gap-3 flex-1">
                  <label className="flex items-center gap-2" title="UMAP: number of nearby points considered when laying out.">
                    <span className="opacity-70">UMAP nNeighbors</span>
                    <input type="range" min={4} max={30} value={umapNNeighbors} onChange={e => setUmapNNeighbors(parseInt(e.target.value))} />
                    <span className="w-10 text-right">{umapNNeighbors}</span>
                  </label>
                  <label className="flex items-center gap-2" title="UMAP: how tightly points pack into clusters (lower = tighter).">
                    <span className="opacity-70">UMAP minDist</span>
                    <input type="range" min={0.05} max={0.8} step={0.05} value={umapMinDist} onChange={e => setUmapMinDist(parseFloat(e.target.value))} />
                    <span className="w-12 text-right">{umapMinDist.toFixed(2)}</span>
                  </label>
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Search size={14} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find/select word…" className="rounded-xl px-3 py-1.5 bg-white/10 border border-white/10" />
              </div>
            </div>
          </div>

          {/* Details / Stats */}
          <div className="rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur">
            <div className="text-sm opacity-80 mb-2">Spotlight</div>
            {selected != null ? (
              <div className="text-sm">
                <div className="mb-2"><span className="opacity-70">Phrase</span>: <span className="font-semibold">{words[selected]}</span></div>
                <div className="opacity-70 mb-1">Nearest neighbors (cosine)</div>
                <ul className="space-y-1">
                  {(selectedNeighbors || []).map(({ index, sim }, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{words[index]}</span>
                      <span className="opacity-70">{sim.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                {/* Token view in Real engine */}
                {engine === "minilm" && (
                  <div className="mt-4">
                    <div className="opacity-70 mb-1">Tokens (BPE) & IDs</div>
                    <div className="flex flex-wrap gap-1">
                      {(realStore[words[selected]]?.tokens || []).map((t, i) => (
                        <div key={i} className="px-2 py-1 rounded-lg border border-white/10 bg-white/10 text-xs">
                          <span className="font-mono">{t}</span>
                          <span className="opacity-60 ml-1">#{realStore[words[selected]]?.tokenIds?.[i]}</span>
                        </div>
                      ))}
                      {(!realStore[words[selected]]?.tokens || realStore[words[selected]]?.tokens?.length === 0) && (
                        <div className="text-xs opacity-60">(tokens will appear after the model finishes loading)</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm opacity-70">Click a placard to see its neighbors and tokens.</div>
            )}
            <div className="mt-4 text-sm opacity-80">Exhibit Stats</div>
            <div className="grid grid-cols-2 gap-2 text-sm mt-1">
              <div className="rounded-xl p-3 bg-white/5 border border-white/10"><div className="opacity-70">Pieces</div><div className="text-xl font-semibold">{words.length}</div></div>
              <div className="rounded-xl p-3 bg-white/5 border border-white/10"><div className="opacity-70">Projection</div><div className="text-xl font-semibold uppercase">{method}</div></div>
              <div className="rounded-xl p-3 bg-white/5 border border-white/10"><div className="opacity-70">Links / node</div><div className="text-xl font-semibold">{neighbors}</div></div>
              <div className="rounded-xl p-3 bg-white/5 border border-white/10"><div className="opacity-70">Engine</div><div className="text-xl font-semibold">{engine === "minilm" ? "Real" : "Toy"}</div></div>
            </div>
            <div className="mt-2 text-xs opacity-70">{testNote}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
          <div className="flex items-center gap-2 p-2 border-b border-white/10">
            <button className={`px-4 py-2 rounded-xl ${tab === "gallery" ? "bg-white/10" : "bg-transparent"}`} onClick={() => setTab("gallery")}>Gallery wall</button>
            <button className={`px-4 py-2 rounded-xl ${tab === "matrix" ? "bg-white/10" : "bg-transparent"}`} onClick={() => setTab("matrix")}>Matrix room</button>
          </div>

          {tab === "gallery" && (
            <div className="relative">
              <div className="absolute inset-6 rounded-[28px] pointer-events-none shadow-[inset_0_0_0_2px_rgba(255,255,255,0.04),_0_40px_80px_-40px_rgba(0,0,0,0.5)]" />

              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[560px] block">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={dark ? "#ffffff10" : "#00000010"} strokeWidth="1" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width={width} height={height} fill="url(#grid)" />

                {/* Neighbor links */}
                {coords.map(([x, y], i) => {
                  if (selected != null && i !== selected) return null;
                  const lines = (selected != null ? neighborList[selected] : neighborList[i]) || [];
                  return lines.map(({ j, s }, k) => {
                    const [x2, y2] = coords[j];
                    const strong = selected != null;
                    const op = strong ? Math.max(0.25, Math.min(1, (s - 0.1))) : Math.max(0, (s - 0.2)) * 0.6;
                    const w = strong ? Math.max(1.5, 4 * op) : Math.max(1, 3 * op);
                    return <line key={`l-${i}-${j}-${k}`} x1={x} y1={y} x2={x2} y2={y2} stroke={dark ? "#ffffff50" : "#00000050"} strokeOpacity={op} strokeWidth={w} />;
                  });
                })}

                {/* Words as placards */}
                <AnimatePresence>
                  {coords.map(([x, y], i) => {
                    const { width: w, height: h, fontSize, text, padX } = labelMetrics(words[i]);
                    const isSel = selected === i;
                    const scale = isSel ? 1.08 : 1;
                    return (
                      <motion.g key={words[i]} initial={{ x: center.x, y: center.y, opacity: 0 }} animate={{ x, y, opacity: selected == null || isSel ? 1 : 0.25, scale }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 120, damping: 18 }} onClick={() => setSelected(i)} style={{ cursor: "pointer" }}>
                        {isSel && <circle cx={0} cy={0} r={30} fill="none" stroke={PALETTE[labels[i] % PALETTE.length]} strokeOpacity={0.6} strokeWidth={2} />}
                        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={10} fill={dark ? "#0b0b0c" : "#ffffff"} stroke={dark ? "#ffffff20" : "#00000010"} />
                        <rect x={-w / 2} y={-h / 2} width={6} height={h} rx={10} fill={PALETTE[labels[i] % PALETTE.length]} />
                        <text x={-w / 2 + padX + 6} y={4} fontSize={fontSize} fill={dark ? "#e5e7eb" : "#111827"} fontWeight={isSel ? 700 : 600}>{text}</text>
                        <text x={-w / 2 + padX + 6} y={18} fontSize={10} fill={dark ? "#9ca3af" : "#4b5563"}>#{i + 1}</text>
                      </motion.g>
                    );
                  })}
                </AnimatePresence>

                {/* Selected label marquee */}
                {selected != null && (
                  <g>
                    <rect x={20} y={height - 44} width={width - 40} height={28} rx={8} fill={dark ? "#ffffff10" : "#00000008"} />
                    <text x={32} y={height - 25} fontSize={14} fill={dark ? "#e5e7eb" : "#111827"}>{words[selected]}</text>
                  </g>
                )}
              </svg>
            </div>
          )}

          {tab === "matrix" && (
            <div className="p-4 overflow-x-auto">
              <div className="mb-3 text-sm opacity-80">Cosine similarity heatmap — hover a cell for values.</div>
              <Heatmap words={words} vectors={vectors} dark={dark} />
            </div>
          )}
        </div>

        <footer className="mt-6 text-xs opacity-70 leading-relaxed">
          <div>
            <span className="font-semibold">How it works:</span> words/phrases → tokenizer (BPE) → <span className="font-semibold">{engine === "minilm" ? "MiniLM" : "toy trigram"}</span> embeddings → cosine similarity → 2D layout via <span className="font-semibold">{method.toUpperCase()}</span>. Links show each point's top‑{neighbors} neighbors by cosine.
          </div>
        </footer>
      </div>

      {helpOpen && (
        <HelpModal onClose={() => setHelpOpen(false)} neighbors={neighbors} />
      )}
    </div>
  );
}