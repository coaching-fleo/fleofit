import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separata da vite.config.ts di proposito: quella costruisce l'app, questa la
// testa. Tenendole distinte, il build di produzione non carica mai jsdom.
// ⚠️ Non creare un vite.config.js: Vite risolve .js prima di .ts e
// maschererebbe in silenzio vite.config.ts, che è la configurazione vera.
export default defineConfig({
  plugins: [react()],
  test: {
    // Serve ai test dei componenti. Quelli di src/lib girerebbero anche senza,
    // ma un solo ambiente evita di marcare i file uno per uno.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/__tests__/**/*.{test,spec}.{js,jsx}'],
  },
})
