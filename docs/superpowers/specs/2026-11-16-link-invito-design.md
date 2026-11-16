# Link d'invito che apre l'app — design breve (16/11/2026)

## Perché
Il coach manda il link d'invito su WhatsApp. Oggi apre sempre il sito, anche dal
telefono, e chi ha (o dovrebbe avere) l'app resta sul browser. Il committente vuole:
da PC si prosegue sul sito; da telefono si apre l'app, o lo Store se manca; il codice
entra da solo.

## Approcci
- **(a) Scelto dal committente** — pagina ponte `/invito/<codice>` che sceglie per
  dispositivo. Dopo l'installazione da Store: su Android il codice passa dal Play
  Install Referrer (automatico); su iOS la pagina copia il codice negli appunti e al
  primo avvio basta «Incolla dagli appunti» (bottone che esiste già).
- (b) Scartato — il server ricorda chi ha aperto il link (fingerprint): serve una
  tabella nuova (schema congelato, regola 0-bis) ed è meno affidabile.
- (c) Scartato — servizi esterni (Branch, Firebase Dynamic Links, chiuso nel 2025):
  dipendenza a pagamento o morta, e i dati degli atleti passerebbero da terzi.

## Cosa si costruisce
- `src/lib/linkInvito.js` (puro, testato): link nuovo, dispositivo dallo user agent,
  URL degli Store, intent Android, codice dai link dell'app e dal referrer.
- Link copiato: `https://fleofit.vercel.app/invito/<codice>`. I vecchi `/?invite=`
  restano validi (già mandati agli atleti).
- Pagina pubblica `/invito/:codice`:
  - PC → `/login?invite=<codice>` subito (come oggi).
  - Android → prova da sola `intent://invito/<codice>#Intent;scheme=fleofit;package=…`:
    app installata = si apre; se no Chrome va al fallback (Play Store con referrer
    quando l'app sarà pubblicata, fino ad allora il sito).
  - iPhone → schermata con il codice: «Scarica l'app» (copia il codice e apre App
    Store), «Ho già l'app» (`fleofit://invito/<codice>`), «Continua sul sito».
- App: `DeeplinkHandler` capisce `fleofit://invito/<codice>` e
  `https://fleofit.vercel.app/invito/<codice>` → `/login?invite=<codice>`.
- Universal link iOS: `public/.well-known/apple-app-site-association` (solo `/invito/*`)
  ed entitlement `applinks:fleofit.vercel.app`. Vale dalla prossima versione sullo Store.
- Android: plugin `InstallReferrerPlugin` (Play Install Referrer), letto una volta al
  primo avvio senza sessione (`fleofit_referrer_letto`).

## Non si fa
- Niente App Links Android verificati (servirebbe l'impronta della chiave di firma del
  Play Store, che ancora non c'è): l'intent fa lo stesso lavoro dalla pagina.
- Nessuna migrazione.

## Lasciato aperto
- `PLAY_STORE_PUBBLICATO` in `linkInvito.js`: finché è false, l'Android senza app
  prosegue sul sito. (`APP_STORE_ID` = 6769451686, messo il 16/11/2026.)
