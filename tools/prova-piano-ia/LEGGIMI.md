# Banco di prova del piano IA

Misura su **30 utenti inventati** (`casi.mjs`) e **4 programmi inventati** (`programmi.mjs`) come si comporta ogni modello candidato, con lo stesso validatore che userà l'app (`src/lib/pianoIA/`). Spec: `docs/superpowers/specs/2026-11-27-pushfit-ai-design.md` §8.2.

Mai dati veri. Mai chiavi in un file: si passano come variabili d'ambiente.

## Comandi

| Cosa | Comando | Costa |
|---|---|---|
| Controllo a secco: la scelta del programma per i 30 casi | `npx jiti tools/prova-piano-ia/prova.mjs --secco` | gratis |
| Adattamento della prima settimana (Sonnet) | `ANTHROPIC_API_KEY=… npx jiti tools/prova-piano-ia/prova.mjs --compito adattamento --modello claude-sonnet-5-5` | ~0,15 $ a caso |
| Lo stesso, un caso solo | `… --solo caso-01` | |
| Analisi dopo la seduta (Haiku) | `ANTHROPIC_API_KEY=… npx jiti tools/prova-piano-ia/prova.mjs --compito analisi --modello claude-haiku-5-5` | ~0,002 $ a caso |
| Analisi con Groq | `GROQ_API_KEY=… npx jiti tools/prova-piano-ia/prova.mjs --compito analisi --modello openai/gpt-oss-120b` | |
| Foglio alla cieca per i coach | `npx jiti tools/prova-piano-ia/prova.mjs --giudizio <aaaa-mm-gg>` | gratis |

I risultati finiscono in `risultati/` (fuori da git): un JSON per giro e una riga per giro in `<data>-riepilogo.md` (salute rispettata, formato/nomi/durata, ripiego sul team, token, costo, tempi).

## Soglie per la produzione (spec §8.2)

- salute (attrezzatura ed esclusioni): **100%**
- formato, nomi, durata: **≥ 95%**
- giudizio dei coach: **≥ 80%** senza «la rifarei»

⚠️ I giri con `--modello` costano soldi veri: si lanciano solo con il sì del committente sul budget.
