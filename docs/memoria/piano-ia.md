# Piano IA (PUSHFIT coach-led + IA) — memoria

> Solo sul branch **`pushfit-ai`** (dal 27/11/2026). Spec: `docs/superpowers/specs/2026-11-27-pushfit-ai-design.md`. Piano: `docs/superpowers/plans/2026-11-27-pushfit-ai.md`.

## Cosa c'è (fase 0, 27/11/2026)
Solo logica pura e un banco di prova: **nessuna schermata, nessuna tabella, nessuna Edge Function pubblicata**. L'app di oggi non cambia.

| File | Cosa fa |
|---|---|
| `src/lib/pianoIA/questionario.js` | valida le 11 risposte, ferma sotto i 18 anni o con un sì alle domande di sicurezza, prepara il profilo **pseudonimizzato** per l'IA |
| `src/lib/pianoIA/programmi.js` | punteggio 0–100 (sedute 40, livello 30, settimane 30), soglia 60; allunga ripetendo le settimane di base, accorcia togliendo le prime (mai scarichi né le ultime 2). Gara passata = «senza gara» |
| `src/lib/pianoIA/regole.js` | progressione +10%, scarico ogni 4 settimane a −30%, gara più leggera della precedente, mai due dure di fila (domenica→lunedì compreso) |
| `src/lib/pianoIA/attrezzatura.js` · `validaSeduta.js` | il validatore: formato (le `prepara*IA` del builder), nomi del picker, durata ±15% con `durataStimataReale`, attrezzatura, esclusioni |
| `src/lib/pianoIA/differenze.js` | l'IA risponde con differenze (`sostituisci`, `numero`, `togli`); se la seduta non passa, resta quella del team |
| `src/lib/pianoIA/riassunto.js` | aderenza, scarto RPE (solo `rpeDichiarato`), carichi, «Come stai»; allarmi `come_stai_basso`, `due_saltate`, `rpe_alto`, `dolore` |
| `src/lib/pianoIA/costi.js` | prezzi e costo per utente al mese (spec §9) |
| `supabase/functions/_shared/pianoIA/richieste.ts` | le richieste a Claude (system uguale per tutti, in cache; JSON con schema), il modello per compito (`PIANO_IA_MODELLO_<COMPITO>`) |
| `tools/prova-piano-ia/` | 30 utenti e 4 programmi INVENTATI; `npx jiti tools/prova-piano-ia/prova.mjs --secco` è gratis |

## Trappole già trovate
- **Node da solo non esegue `src/lib`** (import senza estensione): il banco si lancia con `npx jiti`.
- **Lo schema delle differenze esiste due volte** (`differenze.js` e `richieste.ts`, che non può importare da `src`): un test controlla che coincidano.
- **Haiku 5.5 non ha il fallback lato server**, e il Batch rifiuta `fallbacks`: `richieste.ts` li mette solo su Sonnet/Opus fuori batch.
- Un For Time a time cap dura il suo time cap: la durata di una seduta Hyrox d'esempio si calcola, non si scrive a mano (`programmi.mjs`).

## Ancora da fare
- I giri veri del banco (costano, serve il sì sul budget), poi i numeri misurati nella spec §8–§10.
- Lo staging (Task 11) prima di qualunque tabella.
