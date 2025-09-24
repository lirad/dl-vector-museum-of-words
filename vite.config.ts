import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    port: 3000,
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          math: ['ml-pca', 'umap-js'],
          three: ['three'],
          tokenizer: ['gpt-tokenizer'],
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  define: {
    global: 'globalThis',
  }
})