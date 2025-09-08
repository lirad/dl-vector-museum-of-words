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
            <div className="font-semibold mb-1">UMAP vs PCA (projection)</div>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-semibold">UMAP</span> (non‑linear) preserves <em>local neighborhoods</em> — clusters look tight; global distances may distort.</li>
              <li><span className="font-semibold">PCA</span> (linear) keeps the biggest <em>axes of variance</em> — good for global structure, sometimes spreads clusters.</li>
            </ul>
          </section>
          <section>
            <div className="font-semibold mb-1">MiniLM Embeddings</div>
            <p>
              The app uses <em>MiniLM‑L6‑v2</em> sentence embeddings running in your browser (dim ≈ 384). 
              This provides true semantic similarity and exposes BPE tokens + IDs in the Spotlight view.
              The model downloads automatically on first use and is cached locally.
            </p>
          </section>
          <section>
            <div className="font-semibold mb-1">Matrix room</div>
            <p>Shows pairwise cosine similarity as a heatmap (blue → low, red → high). Hover any cell to see the value.</p>
          </section>
          <section>
            <div className="font-semibold mb-1">🧠 Understanding the Relationships</div>
            <p className="mb-2">
              <span className="font-semibold">Cosine similarity works because:</span> Words with similar meanings have vectors pointing in similar directions in 384D space.
              The <strong>angle</strong> between vectors matters more than their length. MiniLM learned these relationships from massive text datasets.
            </p>
            <div className="text-sm space-y-1">
              <div><strong>🎯 Example relationships you might see:</strong></div>
              <div>• "king" ↔ "queen" = ~0.8 🟢 (very similar, royal concepts)</div>
              <div>• "happy" ↔ "joyful" = ~0.9 🟢 (nearly identical emotions)</div>
              <div>• "car" ↔ "bicycle" = ~0.6 🟡 (both transportation, but different)</div>
              <div>• "love" ↔ "mathematics" = ~0.1 🔴 (unrelated concepts)</div>
            </div>
          </section>
          <section>
            <div className="font-semibold mb-1">🎨 Color Coding</div>
            <div className="text-sm space-y-1">
              <div>🟢 <strong>Green:</strong> Very similar (&gt;0.7) - Strong semantic relationship</div>
              <div>🟡 <strong>Yellow:</strong> Moderately similar (0.4-0.7) - Some connection</div>
              <div>🟠 <strong>Orange:</strong> Weakly similar (0.1-0.4) - Distant relationship</div>
              <div>🔴 <strong>Red:</strong> Unrelated (&lt;0.1) - No meaningful connection</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}