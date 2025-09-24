import { HelpCircle, X } from "lucide-react";

export function HelpModal({ onClose, neighbors }: { onClose: () => void; neighbors: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[min(780px,92vw)] max-h-[86vh] overflow-auto rounded-2xl border border-white/10 bg-zinc-900 text-zinc-100 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-semibold flex items-center gap-2"><HelpCircle size={18}/> Help & Guide</div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/10"><X size={18}/></button>
        </div>
        <div className="space-y-5 text-sm leading-6">
          <section>
            <div className="font-semibold mb-1">Live Drip</div>
            <p>
              When <span className="font-semibold">Live drip</span> is on, the app automatically adds a new curated seed word every ~1.4 seconds.
              It simulates visitors dropping new cards into the gallery so you can watch clusters form in real time. Turn it off to curate manually.
            </p>
          </section>
          <section>
            <div className="font-semibold mb-1">How neighbors are selected</div>
            <p>
              Each phrase becomes a normalized vector. For a given point <code>x</code>, we compute cosine similarity <code>cos(x, y)</code> to every other point <code>y</code> and pick the top‑<span className="font-semibold">{neighbors}</span> (excluding itself). Those become the lines you see.
            </p>
          </section>
          <section>
            <div className="font-semibold mb-1">🔬 Dimensionality Reduction Techniques</div>
            <p className="mb-2">
              High-dimensional data (like our token-based embeddings) needs to be projected to 2D/3D for visualization. Each technique reveals different aspects of the data structure:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="font-semibold text-blue-300 mb-1">🗺️ UMAP (Current)</div>
                <div className="text-xs space-y-1 opacity-90">
                  <div><strong>Type:</strong> Non-linear manifold learning</div>
                  <div><strong>Preserves:</strong> Local neighborhoods & global topology</div>
                  <div><strong>Best for:</strong> Discovering clusters and local structure</div>
                  <div><strong>Speed:</strong> Fast for large datasets</div>
                  <div><strong>Parameters:</strong> n_neighbors (local vs global), min_dist (cluster tightness)</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="font-semibold text-green-300 mb-1">📊 PCA (Current)</div>
                <div className="text-xs space-y-1 opacity-90">
                  <div><strong>Type:</strong> Linear projection</div>
                  <div><strong>Preserves:</strong> Maximum variance directions</div>
                  <div><strong>Best for:</strong> Understanding main data directions</div>
                  <div><strong>Speed:</strong> Very fast, deterministic</div>
                  <div><strong>Limitation:</strong> May miss non-linear patterns</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="font-semibold text-purple-300 mb-1">🌀 t-SNE (Popular Alternative)</div>
                <div className="text-xs space-y-1 opacity-90">
                  <div><strong>Type:</strong> Non-linear, probability-based</div>
                  <div><strong>Preserves:</strong> Local similarities excellently</div>
                  <div><strong>Best for:</strong> Cluster visualization</div>
                  <div><strong>Limitation:</strong> Slow, can create false clusters</div>
                  <div><strong>Note:</strong> Great for exploration but clusters may be misleading</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="font-semibold text-orange-300 mb-1">🔢 Other Methods</div>
                <div className="text-xs space-y-1 opacity-90">
                  <div><strong>Truncated SVD:</strong> Like PCA but for sparse data</div>
                  <div><strong>MDS:</strong> Preserves pairwise distances</div>
                  <div><strong>Isomap:</strong> Non-linear, preserves geodesic distances</div>
                  <div><strong>LLE:</strong> Local linear embedding</div>
                  <div><strong>Random Projection:</strong> Fast approximation</div>
                </div>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="font-semibold text-yellow-300 mb-1">🎯 Which to Choose?</div>
              <div className="text-xs space-y-1 opacity-90">
                <div><strong>For exploration:</strong> Start with UMAP (balanced view) or t-SNE (cluster focus)</div>
                <div><strong>For interpretation:</strong> Use PCA to understand main variance directions</div>
                <div><strong>For speed:</strong> PCA or Random Projection for large datasets</div>
                <div><strong>For publishing:</strong> UMAP is becoming the new standard</div>
              </div>
            </div>
          </section>
          <section>
            <div className="font-semibold mb-1">🤖 How GPT-4 Tokenizer Works</div>
            <p className="mb-2">
              GPT-4's tokenizer learned from vast amounts of text to break down language into meaningful tokens using Byte Pair Encoding (BPE). This creates token-based embeddings where:
            </p>
            <div className="text-sm space-y-1">
              <div>• <strong>Distance = Semantic similarity</strong> (closer = more related)</div>
              <div>• <strong>Direction matters:</strong> "king" → "queen" similar to "man" → "woman"</div>
              <div>• <strong>Context is key:</strong> "bank" (river) vs "bank" (money) have different vectors</div>
              <div>• <strong>Unexpected connections:</strong> Reveals hidden cultural and linguistic patterns</div>
            </div>
          </section>
          <section>
            <div className="font-semibold mb-1">Matrix room</div>
            <p>Shows pairwise cosine similarity as a heatmap (blue → low, red → high). Hover any cell to see the value.</p>
          </section>
          <section>
            <div className="font-semibold mb-1">🔤 Interactive Tokenizer</div>
            <p className="mb-2">
              The tokenizer tab lets you explore how text gets broken down into tokens before being converted to embeddings. This is crucial for understanding how language models process text.
            </p>
            <div className="text-sm space-y-1">
              <div>• <strong>Real-time tokenization:</strong> See tokens update as you type</div>
              <div>• <strong>Color-coded visualization:</strong> Each token gets a unique color</div>
              <div>• <strong>Token statistics:</strong> Character count, compression ratio, and more</div>
              <div>• <strong>Special token detection:</strong> Identifies [CLS], [SEP], and other control tokens</div>
              <div>• <strong>BPE explanation:</strong> Learn how Byte Pair Encoding works</div>
            </div>
          </section>
          <section>
            <div className="font-semibold mb-1">🧠 Understanding Unexpected Relationships</div>
            <p className="mb-2">
              <span className="font-semibold">Why might "dog" and "piano" seem similar?</span> GPT-4's tokenizer learns from how words appear together in text across the internet. Unexpected similarities often reveal hidden connections:
            </p>
            <div className="text-sm space-y-1">
              <div><strong>🔍 Common reasons for surprising similarities:</strong></div>
              <div>• <strong>Shared contexts:</strong> "dog" and "piano" both appear in home/family settings</div>
              <div>• <strong>Cultural associations:</strong> Both are common in children's stories and media</div>
              <div>• <strong>Sensory connections:</strong> Both can "make sounds" (barking, playing)</div>
              <div>• <strong>Emotional contexts:</strong> Both associated with comfort, companionship, learning</div>
              <div>• <strong>Grammatical patterns:</strong> Similar sentence structures and roles</div>
            </div>
          </section>
          <section>
            <div className="font-semibold mb-1">🎯 Typical Relationship Examples</div>
            <div className="text-sm space-y-1">
              <div>• "king" ↔ "queen" = ~0.8 🟢 (obvious semantic relationship)</div>
              <div>• "happy" ↔ "joyful" = ~0.9 🟢 (synonyms)</div>
              <div>• "dog" ↔ "piano" = ~0.3 🟠 (unexpected but contextually related)</div>
              <div>• "car" ↔ "bicycle" = ~0.6 🟡 (category similarity)</div>
              <div>• "love" ↔ "mathematics" = ~0.1 🔴 (truly unrelated)</div>
            </div>
          </section>
          <section>
            <div className="font-semibold mb-1">🎨 Similarity Scale Explained</div>
            <div className="text-sm space-y-1">
              <div>🟢 <strong>Green (0.7-1.0):</strong> Synonyms, obvious relationships ("happy" ↔ "joyful")</div>
              <div>🟡 <strong>Yellow (0.4-0.7):</strong> Same category or domain ("car" ↔ "truck")</div>
              <div>🟠 <strong>Orange (0.1-0.4):</strong> Contextual connections ("dog" ↔ "piano")</div>
              <div>🔴 <strong>Red (0.0-0.1):</strong> No meaningful relationship found</div>
            </div>
            <p className="text-xs mt-2 opacity-80">
              💡 <strong>Pro tip:</strong> Orange connections often reveal the most interesting cultural and contextual patterns!
            </p>
          </section>
          <section>
            <div className="font-semibold mb-1">📖 Real-World Applications</div>
            <div className="text-sm space-y-2">
              <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                <div className="font-semibold text-blue-300 mb-1">🧬 Scientific Research</div>
                <div className="text-xs opacity-90">
                  • <strong>Genomics:</strong> t-SNE for visualizing cell types, UMAP for trajectory analysis<br/>
                  • <strong>Neuroscience:</strong> PCA for brain imaging, dimensionality reduction for neural data<br/>
                  • <strong>Drug discovery:</strong> Chemical space visualization with various projections
                </div>
              </div>
              <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                <div className="font-semibold text-green-300 mb-1">💼 Business & Tech</div>
                <div className="text-xs opacity-90">
                  • <strong>Recommendation systems:</strong> User/product embeddings visualization<br/>
                  • <strong>Document analysis:</strong> Topic clustering and semantic search<br/>
                  • <strong>Market research:</strong> Customer segmentation and behavior patterns
                </div>
              </div>
              <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
                <div className="font-semibold text-purple-300 mb-1">🎨 Creative Fields</div>
                <div className="text-xs opacity-90">
                  • <strong>Art generation:</strong> Style space exploration with neural networks<br/>
                  • <strong>Music analysis:</strong> Genre clustering and similarity visualization<br/>
                  • <strong>Game design:</strong> Procedural content generation and balancing
                </div>
              </div>
            </div>
          </section>
          <section>
            <div className="font-semibold mb-1">🎮 How to Explore</div>
            <div className="text-sm space-y-1">
              <div>1. <strong>Click words</strong> to see their closest neighbors</div>
              <div>2. <strong>Check the Matrix</strong> to compare any two words</div>
              <div>3. <strong>Use 3D view</strong> to see the semantic landscape</div>
              <div>4. <strong>Zoom and rotate</strong> in 3D to examine clusters</div>
              <div>5. <strong>Add your own words</strong> to see where they fit</div>
              <div>6. <strong>Switch between UMAP/PCA</strong> to see different organizational patterns</div>
              <div>7. <strong>Adjust parameters</strong> to understand their effect on clustering</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}