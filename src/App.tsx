import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UMAP } from "umap-js";
import { PCA } from "ml-pca";
import { PlusCircle, Sun, MoonStar, Grid3X3, Map, HelpCircle, Search } from "lucide-react";

import { WallBackground } from "./components/WallBackground";
import { HelpModal } from "./components/HelpModal";
import { Heatmap } from "./components/Heatmap";
import { dot, nearestNeighbors } from "./utils/embeddings";
import { kmeans, normalize2D } from "./utils/clustering";
import { SEED_WORDS, PALETTE, labelMetrics } from "./utils/constants";
import type { RealStoreEntry } from "./types";

// ---------------------------------------------
// Museum of Words — Interactive Vector Matrix
// ---------------------------------------------
// Features:
// • MiniLM-L6‑v2 embeddings powered by @xenova/transformers running in browser
// • Token view: see BPE tokens and IDs for selected phrases
// • UMAP/PCA projections for 2D visualization
// • Interactive neighbors, heatmap, and spotlight views
// ---------------------------------------------

export default function MuseumOfWords() {
  const [words, setWords] = useState<string[]>(() => SEED_WORDS.slice(0, 16));
  const [newWord, setNewWord] = useState("");
  const [method, setMethod] = useState<"umap" | "pca">("umap");
  const [dark, setDark] = useState(true);
  const [live, setLive] = useState(false);
  const [neighbors, setNeighbors] = useState(2);
  const [umapMinDist, setUmapMinDist] = useState(0.15);
  const [umapNNeighbors, setUmapNNeighbors] = useState(12);
  const [tab, setTab] = useState<"gallery" | "matrix">("gallery");
  const [simple, setSimple] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [testNote, setTestNote] = useState<string>("");
  const [query, setQuery] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  // Real model loader state
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [extractor, setExtractor] = useState<any>(null);
  const [tokenizer, setTokenizer] = useState<any>(null);
  const [realStore, setRealStore] = useState<Record<string, RealStoreEntry>>({});
  const [previewEmbedding, setPreviewEmbedding] = useState<Float32Array | null>(null);
  const [previewText, setPreviewText] = useState<string>("");

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

  // Real-time preview while typing (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      getPreviewEmbedding(newWord);
    }, 300);
    return () => clearTimeout(timer);
  }, [newWord, extractor]);

  // Load MiniLM model on startup
  useEffect(() => {
    if (extractor) return;
    (async () => {
      try {
        setLoadingModel(true);
        setModelError(null);
        console.log("Loading MiniLM model...");
        
        const t = await import("@xenova/transformers");
        
        // Configure environment for browser usage - set BEFORE initializing models
        (t as any).env.useBrowserCache = true;
        (t as any).env.allowLocalModels = false; // Use CDN for WASM files to avoid registerBackend errors
        
        console.log("Creating pipeline...");
        const pipe = await (t as any).pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { 
          quantized: true,
          progress_callback: (progress: any) => {
            if (progress.status === 'progress') {
              console.log(`Download progress: ${Math.round(progress.progress * 100)}%`);
            }
          }
        });
        
        console.log("Loading tokenizer...");
        const tok = await (t as any).AutoTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
        
        setExtractor(pipe);
        setTokenizer(tok);
        console.log("MiniLM model loaded successfully!");
      } catch (e: any) {
        console.error("Failed to load MiniLM model:", e);
        setModelError(`Failed to load MiniLM model: ${e.message}. This may be due to network issues or browser compatibility.`);
      } finally {
        setLoadingModel(false);
      }
    })();
  }, [extractor]);

  // Compute/capture embeddings for any words missing
  useEffect(() => {
    if (!extractor || !tokenizer) return;
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
          // ignore single failure for individual words
        }
      }
    })();
    return () => { cancelled = true; };
  }, [extractor, tokenizer, words, realStore]);

  // Compute embeddings (vector list) using MiniLM
  const vectors = useMemo(() => {
    return words.map(w => {
      if (realStore[w]?.vec) {
        return realStore[w].vec;
      }
      // Return random normalized vector if embedding not ready
      // This prevents NaN issues in calculations while model loads
      const randomVec = new Float32Array(384);
      for (let i = 0; i < 384; i++) {
        randomVec[i] = (Math.random() - 0.5) * 0.001; // Small random values
      }
      // Normalize the vector
      let norm = 0;
      for (let i = 0; i < 384; i++) norm += randomVec[i] * randomVec[i];
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < 384; i++) randomVec[i] /= norm;
      return randomVec;
    });
  }, [words, realStore]);

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

  function retryModelLoading() {
    setExtractor(null);
    setTokenizer(null);
    setModelError(null);
    // This will trigger the useEffect to reload the model
  }

  // Real-time embedding preview
  async function getPreviewEmbedding(text: string) {
    if (!extractor || !text.trim()) {
      setPreviewEmbedding(null);
      setPreviewText("");
      return;
    }
    
    try {
      const output = await extractor(text, { pooling: "mean", normalize: true });
      const vec = new Float32Array(output.data);
      setPreviewEmbedding(vec);
      setPreviewText(text);
    } catch (e) {
      console.warn("Preview embedding failed:", e);
      setPreviewEmbedding(null);
      setPreviewText("");
    }
  }

  function resetGallery() {
    setWords(SEED_WORDS.slice(0, 12));
    setSelected(null);
  }

  // System status check
  useEffect(() => {
    if (extractor && tokenizer) {
      setTestNote("MiniLM model loaded successfully");
    } else if (loadingModel) {
      setTestNote("Loading MiniLM model...");
    } else if (modelError) {
      setTestNote("Model loading failed");
    } else {
      setTestNote("Initializing...");
    }
  }, [extractor, tokenizer, loadingModel, modelError]);

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
              <button onClick={addWord} disabled={loadingModel} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-violet-500/90 hover:bg-violet-500 disabled:bg-gray-500/50 disabled:cursor-not-allowed text-white shadow">
                <PlusCircle size={16} /> {loadingModel ? "Loading..." : "Hang it"}
              </button>

            </div>
            
            {/* Real-time embedding preview */}
            {previewText && previewEmbedding && extractor && (
              <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-xs opacity-70 mb-1">🔍 Live Preview: \"{previewText}\"</div>
                <div className="text-xs font-mono opacity-90 mb-1">
                  Vector: [{previewEmbedding.slice(0, 8).map(v => v.toFixed(3)).join(', ')}...]
                </div>
                <div className="text-xs opacity-60">
                  Magnitude: {Math.sqrt(previewEmbedding.reduce((s, v) => s + v*v, 0)).toFixed(3)} | 
                  Top similarity: {vectors.length > 0 && previewEmbedding ? 
                    Math.max(...vectors.map(v => {
                      if (!v || !previewEmbedding) return -1;
                      return v.reduce((sum, val, i) => sum + val * previewEmbedding[i], 0);
                    })).toFixed(3) : 'N/A'}
                </div>
              </div>
            )}

            <div className="mt-2 text-xs opacity-80">
              {loadingModel ? (
                <span>Loading MiniLM model… first run downloads weights and caches them locally.</span>
              ) : modelError ? (
                <div className="flex flex-col gap-2">
                  <span className="text-red-300">{modelError}</span>
                  <button onClick={retryModelLoading} className="self-start rounded-lg px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs border border-red-500/30">
                    Retry Loading
                  </button>
                </div>
              ) : (
                <span>Using <span className="font-semibold">MiniLM-L6‑v2</span> sentence embeddings (dim ≈ 384). Tokens shown in the Spotlight.</span>
              )}
            </div>

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
                
                {/* Vector Info */}
                <div className="mb-3 p-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="opacity-70 text-xs mb-1">Vector (384D)</div>
                  <div className="text-xs font-mono opacity-90 mb-1">
                    [{vectors[selected]?.slice(0, 6).map(v => v.toFixed(3)).join(', ')}...]
                  </div>
                  <div className="text-xs opacity-60">
                    Magnitude: {vectors[selected] ? Math.sqrt(vectors[selected].reduce((s, v) => s + v*v, 0)).toFixed(3) : 'N/A'}
                  </div>
                </div>
                
                <div className="opacity-70 mb-1">Nearest neighbors (cosine similarity)</div>
                <ul className="space-y-1 mb-2">
                  {(selectedNeighbors || []).map(({ index, sim }, i) => {
                    const similarity = sim;
                    const angle = Math.acos(Math.max(-1, Math.min(1, similarity))) * (180 / Math.PI);
                    let color = 'text-red-400';
                    if (similarity > 0.7) color = 'text-green-400';
                    else if (similarity > 0.4) color = 'text-yellow-400';
                    else if (similarity > 0.1) color = 'text-orange-400';
                    
                    return (
                      <li key={i} className="flex justify-between items-center">
                        <span>{words[index]}</span>
                        <div className="text-right">
                          <span className={`font-semibold ${color}`}>{sim.toFixed(3)}</span>
                          <span className="opacity-50 text-xs ml-1">({angle.toFixed(0)}°)</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="text-xs opacity-60 mb-2">
                  💡 Cosine measures vector angle: 1.0=identical, 0.0=unrelated, -1.0=opposite
                </div>
                {/* Token view */}
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
              </div>
            ) : (
              <div className="text-sm opacity-70">Click a placard to see its neighbors and tokens.</div>
            )}
            <div className="mt-4 text-sm opacity-80">Exhibit Stats</div>
            <div className="grid grid-cols-2 gap-2 text-sm mt-1">
              <div className="rounded-xl p-3 bg-white/5 border border-white/10"><div className="opacity-70">Pieces</div><div className="text-xl font-semibold">{words.length}</div></div>
              <div className="rounded-xl p-3 bg-white/5 border border-white/10"><div className="opacity-70">Projection</div><div className="text-xl font-semibold uppercase">{method}</div></div>
              <div className="rounded-xl p-3 bg-white/5 border border-white/10"><div className="opacity-70">Links / node</div><div className="text-xl font-semibold">{neighbors}</div></div>
              <div className="rounded-xl p-3 bg-white/5 border border-white/10"><div className="opacity-70">Engine</div><div className="text-xl font-semibold">MiniLM</div></div>
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
            <span className="font-semibold">How it works:</span> words/phrases → tokenizer (BPE) → <span className="font-semibold">MiniLM</span> embeddings → cosine similarity → 2D layout via <span className="font-semibold">{method.toUpperCase()}</span>. Links show each point's top‑{neighbors} neighbors by cosine.
          </div>
        </footer>
      </div>

      {helpOpen && (
        <HelpModal onClose={() => setHelpOpen(false)} neighbors={neighbors} />
      )}
    </div>
  );
}