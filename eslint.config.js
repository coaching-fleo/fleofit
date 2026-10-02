import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // android/app/src/main/assets/public è la copia del bundle minificato che `npx cap sync android`
  // deposita nel progetto Gradle: analizzarla produce migliaia di falsi problemi e
  // nascondeva quelli veri. .claude e agent sono tooling, non codice del progetto.
  globalIgnores(['dist', 'android/app/src/main/assets/public', 'android/app/build', '.claude', 'agent', '.agents', 'public/sw.js']),
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // I test girano in Node, non nel browser: senza questo `process` e affini
    // risultano non definiti (successo il 26/08/2026 leggendo src/index.css da
    // un test per verificare che i token colore combacino con src/lib/colori.js).
    files: ['src/**/__tests__/**', 'src/test/**', '*.config.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
])
