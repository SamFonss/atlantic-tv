import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('hls.js')) return 'vendor-hls';
            return 'vendor';
          }
          if (id.includes('/api/')) return 'api';
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  preview: {
    port: 3000,
    host: true,
  },
})