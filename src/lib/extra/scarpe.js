// Le Scarpe come extra: la riga viva della card e l'avviso per la Home.
// Mai un'eccezione: qualunque problema (tabelle assenti, interruttore spento,
// rete) = null, cioè niente da dire.

import { leggiScarpeAtleta, elencoCatalogo } from '../scarpeDb'

const attiveDi = async (uid) => {
  const r = await leggiScarpeAtleta(uid)
  if (!r?.disponibile) return null
  return (r.scarpe || []).filter(s => !s.ritirata_at)
}

/** «3 scarpe · una da cambiare» per l'atleta, «12 modelli» per il coach. */
export async function stato(uid, ruolo) {
  try {
    if (ruolo === 'coach') {
      const n = (await elencoCatalogo()).length
      return n ? `${n} ${n === 1 ? 'modello' : 'modelli'}` : null
    }
    const attive = await attiveDi(uid)
    if (!attive?.length) return null
    const oltre = attive.filter(s => s.stato === 'oltre').length
    const base = `${attive.length} ${attive.length === 1 ? 'scarpa' : 'scarpe'}`
    if (!oltre) return base
    return `${base} · ${oltre === 1 ? 'una da cambiare' : `${oltre} da cambiare`}`
  } catch {
    return null
  }
}

/** Solo per l'atleta: una scarpa da cambiare, o l'invito ad aggiungerne una. */
export async function avviso(uid, ruolo) {
  if (ruolo === 'coach') return null
  try {
    const attive = await attiveDi(uid)
    if (!attive) return null
    const da = attive.find(s => s.stato === 'oltre')
    if (da) return { chiave: `cambia:${da.id}`, testo: `${da.modello} è da cambiare`, priorita: 'alta' }
    if (!attive.length) return { chiave: 'aggiungi', testo: 'Tieni il conto dei km delle tue scarpe', priorita: 'normale' }
    return null
  } catch {
    return null
  }
}
