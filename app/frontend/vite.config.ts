import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '^/($|\\?)': 'http://127.0.0.1:8000',
      '/api': 'http://127.0.0.1:8000',
      '/site': 'http://127.0.0.1:8000',
      '/recognize': 'http://127.0.0.1:8000',
      '/detect-layout': 'http://127.0.0.1:8000',
    },
  },
})
