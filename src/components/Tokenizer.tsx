import { useState, useEffect, useMemo } from "react";
import { Copy, RotateCcw, Sparkles, Info } from "lucide-react";

interface ModelInfo {
  name: string;
  encoding: string;
  vocabularySize: number;
  description: string;
}

interface TokenizerProps {
  tokenizer: any;
  dark: boolean;
  modelInfo?: ModelInfo;
}

const EXAMPLE_TEXTS = [
  "hello my friend how are you?",
  "The quick brown fox jumps over the lazy dog.",
  "Machine learning and artificial intelligence are transforming our world.",
  "Tokenization breaks text into subword units for language models.",
  "🌟 Emojis and special characters pose interesting challenges! 🚀",
];

const TOKEN_COLORS = [
  "bg-red-500/20 border-red-500/40",
  "bg-blue-500/20 border-blue-500/40",
  "bg-green-500/20 border-green-500/40",
  "bg-yellow-500/20 border-yellow-500/40",
  "bg-purple-500/20 border-purple-500/40",
  "bg-pink-500/20 border-pink-500/40",
  "bg-indigo-500/20 border-indigo-500/40",
  "bg-orange-500/20 border-orange-500/40",
  "bg-teal-500/20 border-teal-500/40",
  "bg-cyan-500/20 border-cyan-500/40",
];

export function Tokenizer({ tokenizer, dark, modelInfo }: TokenizerProps) {
  const [text, setText] = useState("hello my friend how are you?");
  const [tokens, setTokens] = useState<string[]>([]);
  const [tokenIds, setTokenIds] = useState<number[]>([]);
  const [isTokenizing, setIsTokenizing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Debounced tokenization
  useEffect(() => {
    if (!tokenizer || !text.trim()) {
      setTokens([]);
      setTokenIds([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsTokenizing(true);

        // For gpt-tokenizer, encode returns array of token IDs directly
        const tokenIds = tokenizer.encode ? tokenizer.encode(text) : [];

        // Decode each token ID back to its string representation
        const tokenStrings = tokenIds.map((id: number) => {
          try {
            return tokenizer.decode ? tokenizer.decode([id]) : `[${id}]`;
          } catch (e) {
            return `[${id}]`;
          }
        });
        setTokens(tokenStrings);
        setTokenIds(tokenIds);
      } catch (error) {
        console.error("Tokenization failed:", error);
        setTokens([]);
        setTokenIds([]);
      } finally {
        setIsTokenizing(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [text, tokenizer]);

  const stats = useMemo(() => {
    const charCount = text.length;
    const tokenCount = tokens.length;
    const avgCharsPerToken = tokenCount > 0 ? (charCount / tokenCount).toFixed(1) : "0";
    const compressionRatio = tokenCount > 0 ? ((1 - tokenCount / charCount) * 100).toFixed(1) : "0";

    // Vocabulary usage metrics
    const uniqueTokenIds = new Set(tokenIds);
    const uniqueTokenCount = uniqueTokenIds.size;
    const vocabularyUsage = modelInfo ? ((uniqueTokenCount / modelInfo.vocabularySize) * 100).toFixed(4) : "0";

    // Token ID range analysis
    const minTokenId = tokenIds.length > 0 ? Math.min(...tokenIds) : 0;
    const maxTokenId = tokenIds.length > 0 ? Math.max(...tokenIds) : 0;

    return {
      characters: charCount,
      tokens: tokenCount,
      avgCharsPerToken,
      compressionRatio: parseFloat(compressionRatio) > 0 ? compressionRatio : "0",
      uniqueTokens: uniqueTokenCount,
      vocabularyUsage,
      tokenIdRange: tokenIds.length > 0 ? `${minTokenId}-${maxTokenId}` : "N/A"
    };
  }, [text, tokens, tokenIds, modelInfo]);

  const handleExampleClick = (example: string) => {
    setText(example);
  };

  const handleClear = () => {
    setText("");
    setTokens([]);
    setTokenIds([]);
  };

  const copyTokenIds = () => {
    navigator.clipboard.writeText(JSON.stringify(tokenIds));
  };

  const copyTokens = () => {
    navigator.clipboard.writeText(JSON.stringify(tokens));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">🔤 Interactive Tokenizer</h2>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-1 rounded-lg transition ${dark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
            title="Show/hide tokenization help"
          >
            <Info size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyTokens}
            className={`px-3 py-1.5 rounded-lg border text-sm transition ${
              dark
                ? 'border-white/10 bg-white/5 hover:bg-white/10'
                : 'border-black/10 bg-black/5 hover:bg-black/10'
            }`}
            disabled={tokens.length === 0}
          >
            <Copy size={12} className="inline mr-1" />
            Copy Tokens
          </button>
          <button
            onClick={copyTokenIds}
            className={`px-3 py-1.5 rounded-lg border text-sm transition ${
              dark
                ? 'border-white/10 bg-white/5 hover:bg-white/10'
                : 'border-black/10 bg-black/5 hover:bg-black/10'
            }`}
            disabled={tokenIds.length === 0}
          >
            <Copy size={12} className="inline mr-1" />
            Copy IDs
          </button>
        </div>
      </div>

      {/* Model Information Panel */}
      {modelInfo && (
        <div className={`p-4 rounded-lg border ${
          dark
            ? 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20'
            : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-purple-300 flex items-center gap-2">
              🤖 Model Information
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="opacity-70">Model:</span>
                  <span className="font-semibold">{modelInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Encoding:</span>
                  <span className="font-mono text-blue-300">{modelInfo.encoding}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Vocabulary Size:</span>
                  <span className="font-semibold text-green-300">{modelInfo.vocabularySize.toLocaleString()} tokens</span>
                </div>
              </div>
            </div>
            <div>
              <div className="opacity-90 text-xs leading-relaxed">
                {modelInfo.description}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Panel */}
      {showHelp && (
        <div className={`p-4 rounded-lg border ${
          dark
            ? 'bg-blue-500/10 border-blue-500/20'
            : 'bg-blue-500/10 border-blue-500/30'
        }`}>
          <div className="font-semibold text-blue-300 mb-2">🧠 What is Tokenization?</div>
          <div className="text-sm space-y-2 opacity-90">
            <p>
              <strong>Tokenization</strong> breaks text into smaller units (tokens) that language models can process.
              {modelInfo ? `${modelInfo.name} uses` : 'This model uses'} <strong>Byte Pair Encoding (BPE)</strong> which:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Splits words into subword pieces based on frequency</li>
              <li>Handles unknown words by breaking them into known parts</li>
              <li>Balances vocabulary size with semantic meaning</li>
              <li>Uses special tokens like [CLS] (classification) and [SEP] (separator)</li>
            </ul>
            {modelInfo && (
              <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="font-semibold text-purple-300 mb-2">📚 Model Details</div>
                <ul className="space-y-1">
                  <li><strong>Vocabulary:</strong> {modelInfo.vocabularySize.toLocaleString()} unique tokens</li>
                  <li><strong>Encoding:</strong> {modelInfo.encoding} (same as GPT-4 and GPT-3.5)</li>
                  <li><strong>Token IDs:</strong> Range from 0 to {(modelInfo.vocabularySize - 1).toLocaleString()}</li>
                  <li><strong>Common tokens:</strong> Lower IDs (0-999) = frequent words/characters</li>
                  <li><strong>Rare tokens:</strong> Higher IDs = less frequent subwords and phrases</li>
                </ul>
              </div>
            )}
            <p>
              Each token gets converted to a high-dimensional vector that captures its semantic meaning!
            </p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className={`rounded-lg border p-4 ${
        dark
          ? 'border-white/10 bg-white/5'
          : 'border-black/10 bg-black/5'
      }`}>
        <label className="block text-sm font-semibold mb-2">
          Text Input
          {isTokenizing && (
            <span className="ml-2 text-xs opacity-60 animate-pulse">Tokenizing...</span>
          )}
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste text here to see how it gets tokenized..."
          className={`w-full h-32 p-3 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/50 ${
            dark
              ? 'bg-white/10 border-white/10 text-white placeholder-white/50'
              : 'bg-white border-black/10 text-black placeholder-black/50'
          }`}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, monospace' }}
        />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={handleClear}
            className={`px-3 py-1.5 rounded-lg border text-sm transition flex items-center gap-1 ${
              dark
                ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300'
                : 'border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600'
            }`}
          >
            <RotateCcw size={12} />
            Clear
          </button>
          <div className="text-xs opacity-60 flex items-center">
            <Sparkles size={12} className="mr-1" />
            Examples:
          </div>
          {EXAMPLE_TEXTS.map((example, i) => (
            <button
              key={i}
              onClick={() => handleExampleClick(example)}
              className={`px-3 py-1.5 rounded-lg border text-xs transition ${
                dark
                  ? 'border-white/10 bg-white/5 hover:bg-white/10'
                  : 'border-black/10 bg-black/5 hover:bg-black/10'
              }`}
            >
              {example.substring(0, 25)}{example.length > 25 ? '...' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className={`p-3 rounded-lg border ${
          dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
        }`}>
          <div className="text-sm opacity-70">Characters</div>
          <div className="text-xl font-semibold">{stats.characters}</div>
        </div>
        <div className={`p-3 rounded-lg border ${
          dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
        }`}>
          <div className="text-sm opacity-70">Tokens</div>
          <div className="text-xl font-semibold">{stats.tokens}</div>
        </div>
        <div className={`p-3 rounded-lg border ${
          dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
        }`}>
          <div className="text-sm opacity-70">Unique Tokens</div>
          <div className="text-xl font-semibold text-blue-300">{stats.uniqueTokens}</div>
        </div>
        <div className={`p-3 rounded-lg border ${
          dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
        }`}>
          <div className="text-sm opacity-70">Chars/Token</div>
          <div className="text-xl font-semibold">{stats.avgCharsPerToken}</div>
        </div>
        <div className={`p-3 rounded-lg border ${
          dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
        }`}>
          <div className="text-sm opacity-70">Compression</div>
          <div className="text-xl font-semibold">{stats.compressionRatio}%</div>
        </div>
        <div className={`p-3 rounded-lg border ${
          dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
        }`} title="Percentage of model vocabulary used">
          <div className="text-sm opacity-70">Vocab Usage</div>
          <div className="text-lg font-semibold text-green-300">{stats.vocabularyUsage}%</div>
        </div>
      </div>

      {/* Vocabulary Usage Visualization */}
      {modelInfo && tokens.length > 0 && (
        <div className={`p-4 rounded-lg border ${
          dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
        }`}>
          <div className="font-semibold mb-3 flex items-center gap-2">
            📊 Vocabulary Analysis
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="opacity-70">Token ID Range:</span>
              <span className="font-mono text-blue-300">{stats.tokenIdRange}</span>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="opacity-70">Vocabulary Usage:</span>
                <span className="text-green-300 font-semibold">{stats.uniqueTokens} / {modelInfo.vocabularySize.toLocaleString()}</span>
              </div>
              <div className={`w-full h-2 rounded-full ${dark ? 'bg-white/10' : 'bg-black/10'} overflow-hidden`}>
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min(parseFloat(stats.vocabularyUsage) * 1000, 100)}%` }}
                />
              </div>
              <div className="text-xs opacity-60 mt-1">
                {parseFloat(stats.vocabularyUsage) < 0.001
                  ? "Using a tiny fraction of the model's vocabulary"
                  : `${stats.vocabularyUsage}% of vocabulary utilized`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Token Visualization */}
      {tokens.length > 0 && (
        <div className={`rounded-lg border p-4 ${
          dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
        }`}>
          <div className="font-semibold mb-3 flex items-center gap-2">
            🎨 Token Visualization
            <span className="text-xs opacity-60">({tokens.length} tokens)</span>
          </div>

          {/* Token Display */}
          <div className="flex flex-wrap gap-2 mb-4">
            {tokens.map((token, i) => {
              const tokenId = tokenIds[i];
              const colorClass = TOKEN_COLORS[i % TOKEN_COLORS.length];
              const isSpecialToken = token.startsWith('[') && token.endsWith(']');

              // Classify token based on ID for educational purposes
              let tokenType = 'regular';
              let tokenTypeLabel = 'Regular';
              let tokenTypeColor = 'text-gray-300';

              if (isSpecialToken) {
                tokenType = 'special';
                tokenTypeLabel = 'Special';
                tokenTypeColor = 'text-yellow-300';
              } else if (tokenId < 1000) {
                tokenType = 'common';
                tokenTypeLabel = 'Common';
                tokenTypeColor = 'text-green-300';
              } else if (tokenId < 10000) {
                tokenType = 'frequent';
                tokenTypeLabel = 'Frequent';
                tokenTypeColor = 'text-blue-300';
              } else if (tokenId < 50000) {
                tokenType = 'normal';
                tokenTypeLabel = 'Normal';
                tokenTypeColor = 'text-purple-300';
              } else {
                tokenType = 'rare';
                tokenTypeLabel = 'Rare';
                tokenTypeColor = 'text-orange-300';
              }

              return (
                <div
                  key={i}
                  className={`px-2 py-1.5 rounded-lg border text-sm transition-all hover:scale-105 ${colorClass} ${
                    isSpecialToken ? 'ring-2 ring-yellow-400/50' : ''
                  }`}
                  title={`Token ${i + 1}: "${token}" (ID: ${tokenId})\nType: ${tokenTypeLabel}\nFrequency: ${tokenType === 'common' ? 'Very high' : tokenType === 'frequent' ? 'High' : tokenType === 'normal' ? 'Medium' : tokenType === 'rare' ? 'Low' : 'Special token'}`}
                >
                  <div className="font-mono text-sm font-semibold">
                    {token.replace(/▁/g, '·')} {/* Replace BPE space marker with middle dot */}
                  </div>
                  <div className="text-xs text-center mt-1 space-y-0.5">
                    <div className="opacity-70">#{tokenId}</div>
                    <div className={`text-[10px] font-semibold ${tokenTypeColor}`}>
                      {tokenTypeLabel}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Token Frequency Legend */}
          <div className="border-t pt-4 mt-4 border-white/10">
            <div className="text-sm font-semibold mb-2">🏷️ Token Frequency Classification:</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50"></div>
                <span className="text-green-300">Common (0-999)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/50"></div>
                <span className="text-blue-300">Frequent (1K-10K)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500/50"></div>
                <span className="text-purple-300">Normal (10K-50K)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500/50"></div>
                <span className="text-orange-300">Rare (50K+)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/50"></div>
                <span className="text-yellow-300">Special</span>
              </div>
            </div>
          </div>

          {/* Token IDs List */}
          <div className="border-t pt-4 mt-4 border-white/10">
            <div className="text-sm font-semibold mb-2">Token IDs Array:</div>
            <div className={`p-3 rounded-lg font-mono text-sm break-all ${
              dark ? 'bg-black/20' : 'bg-white/50'
            }`}>
              [{tokenIds.join(', ')}]
            </div>
          </div>

          {/* Special Token Legend */}
          {tokens.some(token => token.startsWith('[') && token.endsWith(']')) && (
            <div className="border-t pt-4 mt-4 border-white/10">
              <div className="text-sm font-semibold mb-2">🏷️ Special Tokens:</div>
              <div className="text-xs opacity-80 space-y-1">
                <div>• <strong>[CLS]</strong>: Classification token (start of sequence)</div>
                <div>• <strong>[SEP]</strong>: Separator token (between sentences)</div>
                <div>• <strong>[UNK]</strong>: Unknown token (out-of-vocabulary)</div>
                <div>• <strong>[PAD]</strong>: Padding token (for batch processing)</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}