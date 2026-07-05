import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        // LLM calls on CPU can be slow; don't let the proxy give up early.
        timeout: 600000,
        proxyTimeout: 600000,
      },
    },
  },
})
