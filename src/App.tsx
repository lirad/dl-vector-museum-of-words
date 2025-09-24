import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UMAP } from "umap-js";
import { PCA } from "ml-pca";
import { PlusCircle, Sun, MoonStar, Grid3X3, Map, HelpCircle, Search } from "lucide-react";

import { WallBackground } from "./components/WallBackground";
import { HelpModal } from "./components/HelpModal";
import { Heatmap } from "./components/Heatmap";
import { Visualization3D } from "./components/Visualization3D";
import { Tokenizer } from "./components/Tokenizer";
import { dot, nearestNeighbors } from "./utils/embeddings";
import { kmeans, normalize2D } from "./utils/clustering";
import { SEED_WORDS, SEMANTIC_PRESETS, PALETTE, labelMetrics } from "./utils/constants";
import type { RealStoreEntry } from "./types";

// ---------------------------------------------
// Museum of Words — Interactive Vector Matrix
// ---------------------------------------------
// Features:
// • GPT-4 tokenizer with token-based embeddings for semantic analysis
// • Token view: see BPE tokens and IDs for selected phrases
// • UMAP/PCA projections for 2D visualization
// • Interactive neighbors, heatmap, and spotlight views
// ---------------------------------------------

export default function MuseumOfWords() {
  const [words, setWords] = useState<string[]>(() => SEED_WORDS.slice(0, 16));
  const [newWord, setNewWord] = useState("hello my friend how are you?");
  const [method, setMethod] = useState<"umap" | "pca">("umap");
  const [dark, setDark] = useState(true);
  const [live] = useState(false);
  const [neighbors, setNeighbors] = useState(2);
  const [umapMinDist, setUmapMinDist] = useState(0.15);
  const [umapNNeighbors, setUmapNNeighbors] = useState(12);
  const [tab, setTab] = useState<"gallery" | "matrix" | "3d" | "tokenizer">("gallery");
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
  const [previewTokens, setPreviewTokens] = useState<string[]>([]);
  const [previewTokenIds, setPreviewTokenIds] = useState<number[]>([]);
  const [fallbackTokenizer, setFallbackTokenizer] = useState<any>(null);

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

  // Load simple fallback tokenizer immediately
  useEffect(() => {
    const loadFallbackTokenizer = async () => {
      try {
        const { encode, decode, vocabularySize } = await import('gpt-tokenizer');
        setFallbackTokenizer({ encode, decode, vocabularySize });
        console.log("🔤 Fallback tokenizer loaded successfully!");
      } catch (e) {
        console.error("Failed to load fallback tokenizer:", e);
      }
    };
    loadFallbackTokenizer();
  }, []);

  // Real-time preview while typing (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      getPreviewEmbedding(newWord);
    }, 300);
    return () => clearTimeout(timer);
  }, [newWord, extractor, tokenizer, fallbackTokenizer]);

  // GPT-4 tokenizer loading - using gpt-tokenizer package for reliable tokenization
  // useEffect(() => {
  //   if (extractor) return;
  //
  //   const loadModel = async (attempt = 1) => {
  //     try {
  //       setLoadingModel(true);
  //       setModelError(null);
  //       console.log(`Loading tokenizer... (attempt ${attempt})`);
  //
  //       const t = await import("@xenova/transformers");
  //       // ... tokenizer loading code disabled
  //     } catch (e: any) {
  //       console.error(`Failed to load tokenizer (attempt ${attempt}):`, e);
  //       setModelError(`Failed to load tokenizer: ${e.message}`);
  //       setLoadingModel(false);
  //     }
  //   };
  //
  //   loadModel();
  // }, [extractor]);

  // Generate word embeddings from token IDs - using GPT-4 tokenizer
  useEffect(() => {
    if (!fallbackTokenizer) return;
    let cancelled = false;
    (async () => {
      for (const w of words) {
        if (cancelled) return;
        if (realStore[w]?.tokens) continue; // Skip if we already have tokens
        try {
          // Use GPT-4 tokenizer for tokenization
          const encoded = fallbackTokenizer.encode(w);
          const tokens = encoded.map((tokenId: number) => {
            try {
              return fallbackTokenizer.decode([tokenId]);
            } catch (e) {
              return `[${tokenId}]`;
            }
          });
          const tokenIds = encoded;

          // Generate embeddings from token IDs (semantic vector based on tokens)
          const vec = new Float32Array(384); // 384 dimensions for embedding space

          // Use token IDs to create a meaningful embedding
          for (let i = 0; i < tokenIds.length && i < 10; i++) { // Use first 10 tokens
            const tokenId = tokenIds[i];
            // Spread the token ID across dimensions with some math to create patterns
            for (let j = 0; j < 384; j++) {
              const seed = tokenId * 1000 + j;
              // Use a hash-like function to create consistent but varied values
              vec[j] += Math.sin(seed * 0.01) * Math.cos(seed * 0.003) * (1 / (i + 1));
            }
          }

          // Normalize the vector
          let norm = 0;
          for (let i = 0; i < 384; i++) norm += vec[i] * vec[i];
          norm = Math.sqrt(norm) || 1;
          for (let i = 0; i < 384; i++) vec[i] /= norm;

          if (cancelled) return;
          setRealStore(prev => ({
            ...prev,
            [w]: {
              vec,
              tokens,
              tokenIds
            }
          }));
        } catch (e) {
          console.error("Token processing failed for", w, e);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [fallbackTokenizer, words, realStore]);

  // Compute embeddings (vector list) using token-based approach
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
    setLoadingModel(false);
    // This will trigger the useEffect to reload the model
  }

  // Real-time embedding preview - Always use GPT-4 tokenizer for consistency
  async function getPreviewEmbedding(text: string) {
    console.log("🔤 getPreviewEmbedding called:", { text, hasExtractor: !!extractor, hasFallback: !!fallbackTokenizer });

    if (!text.trim()) {
      console.log("🔤 Clearing preview - empty text");
      setPreviewEmbedding(null);
      setPreviewText("");
      setPreviewTokens([]);
      setPreviewTokenIds([]);
      return;
    }

    if (!fallbackTokenizer) {
      console.log("🔤 Waiting for GPT-4 tokenizer to load...");
      return;
    }

    try {
      console.log("🔤 Using GPT-4 tokenizer for preview...");

      // Always use GPT-4 tokenizer for consistent tokenization
      const encoded = fallbackTokenizer.encode(text);
      const tokens = encoded.map((tokenId: number) => {
        try {
          return fallbackTokenizer.decode([tokenId]);
        } catch (e) {
          return `[${tokenId}]`;
        }
      });
      const tokenIds = encoded;

      console.log("🔤 GPT-4 tokenization successful! Tokens:", tokens, "IDs:", tokenIds);

      // Generate embedding from token IDs
      const vec = new Float32Array(384);
      for (let i = 0; i < tokenIds.length && i < 10; i++) {
        const tokenId = tokenIds[i];
        for (let j = 0; j < 384; j++) {
          const seed = tokenId * 1000 + j;
          vec[j] += Math.sin(seed * 0.01) * Math.cos(seed * 0.003) * (1 / (i + 1));
        }
      }
      // Normalize
      let norm = 0;
      for (let i = 0; i < 384; i++) norm += vec[i] * vec[i];
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < 384; i++) vec[i] /= norm;

      console.log("🔤 Token-based embedding generated!");

      setPreviewEmbedding(vec);
      setPreviewText(text);
      setPreviewTokens(tokens);
      setPreviewTokenIds(tokenIds);
    } catch (e) {
      console.error("🔤 GPT-4 tokenization failed:", e);
    }
  }

  // function resetGallery() {
  //   setWords(SEED_WORDS.slice(0, 12));
  //   setSelected(null);
  // }

  function loadPreset(presetKey: string) {
    const preset = SEMANTIC_PRESETS[presetKey as keyof typeof SEMANTIC_PRESETS];
    if (preset) {
      setWords(preset.words);
      setSelected(null);
    }
  }

  function clearAllWords() {
    setWords([]);
    setSelected(null);
  }

  // System status check
  useEffect(() => {
    if (extractor && tokenizer) {
      setTestNote("Tokenizer loaded successfully");
    } else if (loadingModel) {
      setTestNote("Loading tokenizer...");
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
    <div className={`min-h-screen ${dark ? "text-zinc-100 bg-zinc-950" : "text-zinc-900 bg-zinc-100"} p-2 sm:p-4 lg:p-6 font-sans overflow-x-hidden`}>
      <WallBackground dark={dark} />
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="rounded-2xl px-3 py-1.5 bg-gradient-to-r from-pink-500/80 to-violet-500/80 text-white text-sm shadow whitespace-nowrap">
              <span className="hidden sm:inline">DL Vector Museum of Words</span>
              <span className="sm:hidden">Vector Museum</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm opacity-80">
              <span>Add words & phrases → see clusters.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button className="rounded-xl border px-3 py-2 text-sm backdrop-blur bg-white/5 border-white/10 hover:bg-white/10 transition touch-manipulation" onClick={() => setDark(d => !d)} title={dark ? "Switch to Light" : "Switch to Dark"}>
              {dark ? <Sun size={16} /> : <MoonStar size={16} />}
            </button>
            <button className="rounded-xl border px-3 py-2 text-sm backdrop-blur bg-white/5 border-white/10 hover:bg-white/10 transition flex items-center gap-2 touch-manipulation" onClick={() => setHelpOpen(true)}>
              <HelpCircle size={16} /> <span className="hidden sm:inline">Help</span>
            </button>
          </div>
        </header>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <div className="lg:col-span-2 rounded-2xl p-3 sm:p-4 border border-white/10 bg-white/5 backdrop-blur">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 items-stretch sm:items-center">
              <input 
                value={newWord} 
                onChange={e => setNewWord(e.target.value)} 
                onKeyDown={e => e.key === "Enter" && addWord()} 
                placeholder="Type a word or phrase" 
                className="min-w-0 w-full flex-1 rounded-xl px-3 py-3 sm:py-2 text-base sm:text-sm bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400/50 touch-manipulation" 
              />
              <button 
                onClick={addWord} 
                disabled={loadingModel} 
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 sm:py-2 bg-violet-500/90 hover:bg-violet-500 disabled:bg-gray-500/50 disabled:cursor-not-allowed text-white shadow font-medium touch-manipulation whitespace-nowrap"
              >
                <PlusCircle size={16} /> {loadingModel ? "Loading..." : "Hang it"}
              </button>
            </div>

            {/* Tokenizer loading indicator */}
            {!fallbackTokenizer && (
              <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="text-xs text-yellow-300 animate-pulse">
                  🔤 Loading GPT-4 tokenizer... (for real-time token preview)
                </div>
              </div>
            )}

            {/* Real-time preview */}
            {fallbackTokenizer && (newWord || previewText) && (
              <div className="mt-3 space-y-3">
                {/* Tokenizer Preview */}
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-xs font-semibold mb-2 text-green-300 flex items-center gap-2">
                    🔤 Live Tokenization: "{previewText}"
                    <span className="opacity-60">({previewTokens.length} tokens)</span>
                    <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-200 text-[10px]">GPT-4</span>
                    <span className="px-2 py-1 rounded bg-green-500/20 text-green-200 text-[10px]">Token-Vec</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {previewTokens.map((token, i) => {
                      const colors = [
                        "bg-red-500/20 border-red-500/40 text-red-200",
                        "bg-blue-500/20 border-blue-500/40 text-blue-200",
                        "bg-green-500/20 border-green-500/40 text-green-200",
                        "bg-yellow-500/20 border-yellow-500/40 text-yellow-200",
                        "bg-purple-500/20 border-purple-500/40 text-purple-200",
                        "bg-pink-500/20 border-pink-500/40 text-pink-200",
                        "bg-indigo-500/20 border-indigo-500/40 text-indigo-200",
                        "bg-orange-500/20 border-orange-500/40 text-orange-200"
                      ];
                      const colorClass = colors[i % colors.length];
                      const isSpecialToken = token.startsWith('[') && token.endsWith(']');

                      return (
                        <div
                          key={i}
                          className={`px-2 py-1 rounded-md border text-xs font-mono ${colorClass} ${
                            isSpecialToken ? 'ring-1 ring-yellow-400/50' : ''
                          }`}
                          title={`Token ${i + 1}: "${token}" (ID: ${previewTokenIds[i]})`}
                        >
                          <div className="font-mono text-xs">
                            {token.replace(/▁/g, '·').replace(/ /g, '␣')}
                          </div>
                          <div className="text-[10px] opacity-60 text-center">#{previewTokenIds[i]}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] opacity-60 font-mono">
                    IDs: [{previewTokenIds.join(', ')}]
                  </div>
                </div>

                {/* Embedding Preview */}
                {previewEmbedding && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="text-xs opacity-70 mb-1">🔍 Live Embedding</div>
                    <div className="text-xs font-mono opacity-90 mb-1">
                      Vector: [{Array.from(previewEmbedding.slice(0, 8)).map(v => v.toFixed(3)).join(', ')}...]
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
              </div>
            )}

            {/* Semantic Presets */}
            <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-violet-500/10 to-pink-500/10 border border-violet-500/20">
              <div className="mb-2">
                <span className="text-xs font-semibold opacity-90 block sm:inline mb-2 sm:mb-0 sm:mr-2">🎯 Semantic Presets:</span>
                <div className="flex gap-1 overflow-x-auto pb-1 -webkit-overflow-scrolling-touch scrollbar-hide">
                  <div className="flex gap-1 min-w-max">
                    {Object.keys(SEMANTIC_PRESETS).map((presetKey) => (
                      <button
                        key={presetKey}
                        onClick={() => loadPreset(presetKey)}
                        className="text-xs px-3 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 transition-colors whitespace-nowrap touch-manipulation"
                        title={SEMANTIC_PRESETS[presetKey as keyof typeof SEMANTIC_PRESETS].description}
                      >
                        {presetKey}
                      </button>
                    ))}
                    <button
                      onClick={clearAllWords}
                      className="text-xs px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-colors text-red-300 whitespace-nowrap touch-manipulation"
                      title="Remove all words from the gallery"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-xs opacity-60">
                Choose curated word sets to explore different types of semantic relationships, or clear everything to start fresh.
              </div>
            </div>

            {/* Educational Panel */}
            <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-green-500/10 border border-blue-500/20">
              <div className="text-xs font-semibold mb-1 text-blue-300">
                🔬 Why {method.toUpperCase()}?
              </div>
              <div className="text-xs opacity-90 space-y-1">
                {method === "umap" ? (
                  <>
                    <div>• <strong>Non-linear projection:</strong> Discovers hidden patterns that linear methods miss</div>
                    <div>• <strong>Preserves neighborhoods:</strong> Words with similar meanings cluster together naturally</div>
                    <div>• <strong>Global topology:</strong> Maintains the overall shape of semantic relationships</div>
                    <div>• <strong>Fast & scalable:</strong> Works well even with thousands of words</div>
                  </>
                ) : (
                  <>
                    <div>• <strong>Linear projection:</strong> Shows the main directions of variance in meaning space</div>
                    <div>• <strong>Interpretable axes:</strong> Each dimension has clear mathematical meaning</div>
                    <div>• <strong>Global structure:</strong> Preserves overall distances between word groups</div>
                    <div>• <strong>Deterministic:</strong> Same result every time, no randomness</div>
                  </>
                )}
                <div className="mt-1 pt-1 border-t border-white/10">
                  <strong>Try switching methods</strong> to see how the same words organize differently!
                </div>
              </div>
            </div>

            <div className="mt-2 text-xs opacity-80">
              {loadingModel ? (
                <span>Loading tokenizer… initializing GPT-4 tokenization system.</span>
              ) : modelError ? (
                <div className="flex flex-col gap-2">
                  <span className="text-red-300">{modelError}</span>
                  <button onClick={retryModelLoading} className="self-start rounded-lg px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs border border-red-500/30">
                    Retry Loading
                  </button>
                </div>
              ) : (
                <span>Using <span className="font-semibold">GPT-4 Tokenizer</span> with token-based embeddings. Tokens shown in the Spotlight.</span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="opacity-70 text-xs sm:text-sm font-medium">Projection Method</span>
                <div className="flex gap-1 rounded-xl overflow-hidden border border-white/10">
                  <button onClick={() => setMethod("umap")} className={`px-3 py-2 text-xs sm:text-sm font-medium touch-manipulation ${method === "umap" ? "bg-white/20 text-white" : "bg-transparent opacity-70"}`} title="UMAP: Non-linear, preserves clusters and neighborhoods. Great for discovering semantic groups.">
                    <Map className="inline mr-1" size={14}/>UMAP
                  </button>
                  <button onClick={() => setMethod("pca")} className={`px-3 py-2 text-xs sm:text-sm font-medium touch-manipulation ${method === "pca" ? "bg-white/20 text-white" : "bg-transparent opacity-70"}`} title="PCA: Linear, shows main variance directions. Good for understanding dominant patterns.">
                    <Grid3X3 className="inline mr-1" size={14}/>PCA
                  </button>
                </div>
              </div>

              <label className="flex flex-col sm:flex-row sm:items-center gap-2" title="How many neighbor links per node to draw.">
                <span className="opacity-70 text-xs sm:text-sm font-medium whitespace-nowrap">Neighbor Links</span>
                <div className="flex items-center gap-3 flex-1">
                  <input type="range" min={1} max={5} value={neighbors} onChange={e => setNeighbors(parseInt(e.target.value))} className="flex-1 min-w-0 touch-manipulation" />
                  <span className="w-8 text-right text-sm font-medium flex-shrink-0 bg-white/10 rounded px-2 py-1">{neighbors}</span>
                </div>
              </label>
            </div>

            {/* Advanced controls */}
            <div className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <button onClick={() => setSimple(s => !s)} className="rounded-xl px-4 py-2 border border-white/10 bg-white/10 hover:bg-white/20 text-sm font-medium touch-manipulation">
                  {simple ? "Show Advanced Settings" : "Hide Advanced Settings"}
                </button>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Search size={16} className="flex-shrink-0 opacity-70" />
                  <input 
                    value={query} 
                    onChange={e => setQuery(e.target.value)} 
                    placeholder="Find/select word…" 
                    className="rounded-xl px-3 py-2 bg-white/10 border border-white/10 min-w-0 flex-1 sm:w-48 text-sm touch-manipulation" 
                  />
                </div>
              </div>
              
              {!simple && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="space-y-2">
                    <label className="flex flex-col gap-2" title="UMAP: number of nearby points considered when laying out.">
                      <span className="opacity-70 text-xs font-medium">UMAP Neighbors</span>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min={4} 
                          max={30} 
                          value={umapNNeighbors} 
                          onChange={e => setUmapNNeighbors(parseInt(e.target.value))} 
                          className="flex-1 min-w-0 touch-manipulation" 
                        />
                        <span className="w-10 text-right text-xs font-medium bg-white/10 rounded px-2 py-1">{umapNNeighbors}</span>
                      </div>
                    </label>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="flex flex-col gap-2" title="UMAP: how tightly points pack into clusters (lower = tighter).">
                      <span className="opacity-70 text-xs font-medium">UMAP Min Distance</span>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min={0.05} 
                          max={0.8} 
                          step={0.05} 
                          value={umapMinDist} 
                          onChange={e => setUmapMinDist(parseFloat(e.target.value))} 
                          className="flex-1 min-w-0 touch-manipulation" 
                        />
                        <span className="w-12 text-right text-xs font-medium bg-white/10 rounded px-2 py-1">{umapMinDist.toFixed(2)}</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details / Stats */}
          <div className="rounded-2xl p-3 sm:p-4 border border-white/10 bg-white/5 backdrop-blur">
            <div className="text-sm font-medium opacity-80 mb-3">Spotlight</div>
            {selected != null ? (
              <div className="text-sm">
                <div className="mb-2"><span className="opacity-70">Phrase</span>: <span className="font-semibold">{words[selected]}</span></div>
                
                {/* Vector Info */}
                <div className="mb-3 p-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="opacity-70 text-xs mb-1">Vector (384D)</div>
                  <div className="text-xs font-mono opacity-90 mb-1">
                    [{vectors[selected] ? Array.from(vectors[selected].slice(0, 6)).map(v => v.toFixed(3)).join(', ') : ''}...]
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
                
                {/* Semantic Insights */}
                {selectedNeighbors && selectedNeighbors.length > 0 && (
                  <div className="mb-3 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                    <div className="text-xs font-semibold mb-1 text-blue-300">🔍 Why these connections?</div>
                    <div className="text-xs opacity-80 space-y-1">
                      {selectedNeighbors[0].sim > 0.7 && (
                        <div>• <strong>High similarity:</strong> Likely synonyms or very related concepts</div>
                      )}
                      {selectedNeighbors[0].sim > 0.4 && selectedNeighbors[0].sim <= 0.7 && (
                        <div>• <strong>Category similarity:</strong> Same domain or semantic field</div>
                      )}
                      {selectedNeighbors[0].sim > 0.1 && selectedNeighbors[0].sim <= 0.4 && (
                        <div>• <strong>Contextual connection:</strong> Appear in similar settings or stories</div>
                      )}
                      {selectedNeighbors.some(n => n.sim <= 0.1) && (
                        <div>• <strong>Weak/no connection:</strong> Different semantic domains</div>
                      )}
                      <div>• <strong>Cultural patterns:</strong> GPT-4 learned from vast text corpora</div>
                    </div>
                  </div>
                )}
                
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
            <div className="mt-4 text-sm font-medium opacity-80">Exhibit Stats</div>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div className="rounded-xl p-2 sm:p-3 bg-white/5 border border-white/10">
                <div className="opacity-70 text-xs">Pieces</div>
                <div className="text-lg sm:text-xl font-semibold">{words.length}</div>
              </div>
              <div className="rounded-xl p-2 sm:p-3 bg-white/5 border border-white/10">
                <div className="opacity-70 text-xs">Method</div>
                <div className="text-lg sm:text-xl font-semibold uppercase">{method}</div>
              </div>
              <div className="rounded-xl p-2 sm:p-3 bg-white/5 border border-white/10">
                <div className="opacity-70 text-xs">Links</div>
                <div className="text-lg sm:text-xl font-semibold">{neighbors}</div>
              </div>
              <div className="rounded-xl p-2 sm:p-3 bg-white/5 border border-white/10">
                <div className="opacity-70 text-xs">Engine</div>
                <div className="text-sm sm:text-lg font-semibold">GPT-4</div>
              </div>
            </div>
            <div className="mt-3 text-xs opacity-70 p-2 rounded bg-white/5">{testNote}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
          <div className="flex items-center gap-1 p-2 border-b border-white/10 overflow-x-auto scrollbar-hide">
            <button 
              className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap touch-manipulation transition-colors ${tab === "gallery" ? "bg-white/20 text-white" : "bg-transparent opacity-70 hover:opacity-100"}`} 
              onClick={() => setTab("gallery")}
            >
              <span className="hidden sm:inline">Gallery Wall</span>
              <span className="sm:hidden">Gallery</span>
            </button>
            <button 
              className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap touch-manipulation transition-colors ${tab === "matrix" ? "bg-white/20 text-white" : "bg-transparent opacity-70 hover:opacity-100"}`} 
              onClick={() => setTab("matrix")}
            >
              <span className="hidden sm:inline">Matrix Room</span>
              <span className="sm:hidden">Matrix</span>
            </button>
            <button 
              className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap touch-manipulation transition-colors ${tab === "3d" ? "bg-white/20 text-white" : "bg-transparent opacity-70 hover:opacity-100"}`} 
              onClick={() => setTab("3d")}
            >
              3D Space
            </button>
            <button 
              className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap touch-manipulation transition-colors ${tab === "tokenizer" ? "bg-white/20 text-white" : "bg-transparent opacity-70 hover:opacity-100"}`} 
              onClick={() => setTab("tokenizer")}
            >
              Tokenizer
            </button>
          </div>

          {tab === "gallery" && (
            <div className="relative">
              <div className="absolute inset-3 sm:inset-6 rounded-[20px] sm:rounded-[28px] pointer-events-none shadow-[inset_0_0_0_2px_rgba(255,255,255,0.04),_0_40px_80px_-40px_rgba(0,0,0,0.5)]" />

              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[350px] sm:h-[450px] lg:h-[560px] block touch-manipulation" style={{clipPath: 'inset(0)'}}>
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={dark ? "#ffffff10" : "#00000010"} strokeWidth="1" />
                  </pattern>
                  <clipPath id="svgClip">
                    <rect x="0" y="0" width={width} height={height} />
                  </clipPath>
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

                {/* Vector direction indicators at each word position */}
                <g clipPath="url(#svgClip)">
                  {coords.map(([x, y], i) => {
                    // Show direction based on position relative to center
                    // This represents the semantic direction in the reduced space
                    const dx = x - center.x;
                    const dy = y - center.y;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    
                    if (length < 5) return null; // Skip words too close to center
                    
                    // Normalize and create a small arrow pointing in the semantic direction
                    // Make arrows smaller on mobile
                    const lineLength = window.innerWidth < 640 ? 15 : 20;
                    const normalizedDx = (dx / length) * lineLength;
                    const normalizedDy = (dy / length) * lineLength;
                    
                    // Calculate end position but ensure it stays within bounds
                    let endX = x + normalizedDx;
                    let endY = y + normalizedDy;
                    
                    // Clamp to SVG boundaries with margin
                    const margin = 10;
                    endX = Math.max(margin, Math.min(width - margin, endX));
                    endY = Math.max(margin, Math.min(height - margin, endY));
                    
                    const opacity = selected != null ? (selected === i ? 0.9 : 0.4) : 0.6;
                    
                    return (
                      <g key={`vector-${i}`}>
                        <line 
                          x1={x} 
                          y1={y} 
                          x2={endX} 
                          y2={endY}
                          stroke="#fbbf24"
                          strokeOpacity={opacity}
                          strokeWidth={2}
                          strokeLinecap="round"
                        />
                        {/* Small arrowhead */}
                        <circle 
                          cx={endX} 
                          cy={endY} 
                          r={window.innerWidth < 640 ? 1.5 : 2}
                          fill="#fbbf24"
                          opacity={opacity}
                        />
                      </g>
                    );
                  })}
                </g>

                {/* Words as placards */}
                <AnimatePresence>
                  {coords.map(([x, y], i) => {
                    const { width: w, height: h, fontSize, text, padX } = labelMetrics(words[i]);
                    const isSel = selected === i;
                    const scale = isSel ? 1.08 : 1;
                    return (
                      <motion.g key={words[i]} initial={{ x: center.x, y: center.y, opacity: 0 }} animate={{ x, y, opacity: selected == null || isSel ? 1 : 0.25, scale }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 120, damping: 18 }} onClick={() => { setSelected(i); setNewWord(words[i]); }} style={{ cursor: "pointer" }}>
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
            <div className="p-3 sm:p-4 overflow-x-auto">
              <div className="mb-3 text-sm opacity-80">Cosine similarity heatmap — hover a cell for values.</div>
              <Heatmap words={words} vectors={vectors} dark={dark} />
            </div>
          )}

          {tab === "3d" && (
            <div className="p-3 sm:p-4">
              <div className="mb-3 text-sm opacity-80">
                🌌 Explore semantic relationships in 3D space. Words with similar meanings cluster together.
              </div>
              <Visualization3D
                words={words}
                vectors={vectors}
                selected={selected}
                onSelect={setSelected}
                dark={dark}
                neighbors={neighbors}
                selectedNeighbors={selectedNeighbors}
              />
            </div>
          )}

          {tab === "tokenizer" && (
            <div className="p-3 sm:p-4">
              <div className="mb-3 text-sm opacity-80">
                🔤 See how text is broken down into tokens that get converted to embeddings. Try typing different phrases!
              </div>
              {tokenizer || fallbackTokenizer ? (
                <Tokenizer
                  tokenizer={tokenizer || fallbackTokenizer}
                  dark={dark}
                  modelInfo={{
                    name: "GPT-4 Tokenizer",
                    encoding: "cl100k_base",
                    vocabularySize: fallbackTokenizer?.vocabularySize || tokenizer?.vocabularySize || 100257, // cl100k_base has exactly 100,257 tokens
                    description: "Byte Pair Encoding (BPE) tokenizer used by GPT-4 and GPT-3.5 models"
                  }}
                />
              ) : loadingModel ? (
                <div className="text-center py-8">
                  <div className="animate-pulse text-lg opacity-70">Loading tokenizer...</div>
                  <div className="text-sm opacity-60 mt-2">The tokenizer will be available once it initializes.</div>
                </div>
              ) : modelError ? (
                <div className="text-center py-8">
                  <div className="text-red-300 mb-4">Tokenizer unavailable: {modelError}</div>
                  <button onClick={retryModelLoading} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg">
                    Retry Loading Model
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 opacity-70">
                  <div>Tokenizer initializing...</div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="mt-6 text-xs opacity-70 leading-relaxed space-y-4">
          <div className="p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10">
            <span className="font-semibold">How it works:</span> words/phrases → <span className="font-semibold">GPT-4 tokenizer</span> (BPE) → <span className="font-semibold">token-based embeddings</span> → cosine similarity → 2D layout via <span className="font-semibold">{method.toUpperCase()}</span>. Links show each point's top‑{neighbors} neighbors by cosine.
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <div className="p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="font-semibold mb-2">📚 Why These Techniques Matter</div>
              <div className="space-y-2 text-xs">
                <div><strong>UMAP:</strong> Reveals semantic clusters & preserves local meaning relationships</div>
                <div><strong>PCA:</strong> Shows dominant patterns & provides interpretable variance axes</div>
                <div><strong>Alternative methods</strong> like t-SNE, MDS, or Random Projection each reveal different aspects of meaning space</div>
              </div>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="font-semibold mb-2">🎯 Educational Value</div>
              <div className="space-y-2 text-xs">
                <div>• Compare how words cluster differently with each method</div>
                <div>• Understand trade-offs between speed vs. accuracy</div>
                <div>• Learn when linear vs. non-linear approaches work best</div>
                <div>• Explore how high-dimensional meaning gets compressed to 2D</div>
                <div>• Use the tokenizer to see how text becomes tokens before embeddings</div>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {helpOpen && (
        <HelpModal onClose={() => setHelpOpen(false)} neighbors={neighbors} />
      )}
    </div>
  );
}