import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // ios/App/App/public è la copia del bundle minificato che `npx cap sync ios`
  // deposita nel progetto Xcode: analizzarla produceva 4.700 falsi problemi e
  // nascondeva quelli veri. .claude e agent sono tooling, non codice del progetto.
  globalIgnores(['dist', 'ios/App/App/public', '.claude', 'agent', '.agents', 'public/sw.js']),
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
])
