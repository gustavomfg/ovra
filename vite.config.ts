import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/ovra/',
  plugins: [react()],
  build: {
    // React, GSAP and Motion share the entry chunk; every shader is split into its own lazy chunk.
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
