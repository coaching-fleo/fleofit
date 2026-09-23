import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './',
  build: {
    // Il chunk d'ingresso `index` sta intorno ai 592 KB (CLAUDE.md §2), quindi
    // il limite di 500 faceva suonare l'avviso a OGNI build — e un avviso che
    // suona sempre smette di essere letto. A 620 torna a significare qualcosa:
    // scatta solo se qualcuno importa in modo NON pigro un pezzo montato da
    // più pagine (è ciò che il recap avrebbe fatto, §9-quadragies punto 6).
    chunkSizeWarningLimit: 620,
  },
  server: {
    host: '0.0.0.0',  
    port: 5173,       
    allowedHosts: true
  }
})