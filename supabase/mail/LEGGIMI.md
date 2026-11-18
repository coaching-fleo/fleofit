# I modelli delle mail di Supabase (dal 18/11/2026)

Si incollano a mano in **Supabase → Authentication → Emails → Templates**.
Il file qui è la copia di riferimento: chi cambia un modello lo cambia anche qui.

| File | Modello in Supabase | Oggetto |
|---|---|---|
| `conferma-iscrizione.html` | **Confirm signup** | `Conferma il tuo indirizzo · PUSHFIT` |
| `reset-password.html` | **Reset password** | `Scegli una password nuova · PUSHFIT` |

Il link non porta più a `…supabase.co/auth/v1/verify` ma alla pagina `/conferma`
del sito (`src/pages/Conferma.jsx`, `src/lib/confermaLink.js`), che verifica il
codice al tocco del bottone e rimanda all'app o al sito come faceva Supabase.

⚠️ **Ordine**: prima il sito pubblicato con la pagina `/conferma` (`app:main`),
POI i modelli. Al contrario, i link delle mail porterebbero a una pagina che
non esiste ancora.

⚠️ `torna={{ .RedirectTo }}` va **per ultimo** nell'indirizzo: la pagina lo
legge fino in fondo, con la sua query (`?inviteCode=…`).

⚠️ Quando il sito passa a `pushfit.it`, si cambia l'indirizzo nei due modelli.
