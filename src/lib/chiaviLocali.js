/**
 * Il trasloco delle chiavi del dispositivo, da `fleofit_*` a `pushfit_*`.
 *
 * Fino al 17/11/2026 l'app si chiamava FLEOFIT e salvava sul telefono con il
 * prefisso `fleofit_` (bozze, coda offline, cache, preferenze). Dal cambio di
 * nome tutto il codice usa `pushfit_`: chi aggiorna l'app ha però i dati sotto
 * il prefisso vecchio, e senza trasloco perderebbe bozze e allenamenti in coda.
 *
 * ⚠️ Deve girare PRIMA di qualunque altro modulo: per questo `traslocoChiavi.js`
 * lo chiama ed è il PRIMO import di `main.jsx` (i moduli si eseguono
 * nell'ordine degli import, e alcuni leggono localStorage appena caricati).
 *
 * La sessione di Supabase non c'entra: sta in `sb-<progetto>-auth-token`.
 */
export const PREFISSO = 'pushfit_'
export const PREFISSO_VECCHIO = 'fleofit_'

/**
 * Sposta ogni `fleofit_x` in `pushfit_x` e cancella il vecchio.
 * Se `pushfit_x` c'è già vince il nuovo. Copia prima e cancella dopo, così
 * un'interruzione a metà si completa al riavvio. Ritorna quante chiavi ha
 * spostato; con uno storage che non risponde ritorna 0 e non lancia.
 */
export function traslocaChiavi(storage = globalThis.localStorage) {
  try {
    if (!storage) return 0
    const vecchie = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && k.startsWith(PREFISSO_VECCHIO)) vecchie.push(k)
    }
    let spostate = 0
    for (const k of vecchie) {
      const nuova = PREFISSO + k.slice(PREFISSO_VECCHIO.length)
      if (storage.getItem(nuova) === null) {
        storage.setItem(nuova, storage.getItem(k))
        spostate++
      }
      storage.removeItem(k)
    }
    return spostate
  } catch {
    return 0
  }
}
