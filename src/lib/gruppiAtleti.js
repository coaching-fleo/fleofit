// Gruppi di atleti (16/11/2026, docs/superpowers/specs/2026-11-16-gruppi-atleti-design.md):
// una scorciatoia SOLO del coach. Nel foglio «Assegna Workout» toccare un gruppo
// spunta i suoi atleti; l'atleta non sa di essere in un gruppo.
//
// Regola che vale per tutto il file: un gruppo conta solo gli atleti che il coach
// VEDE ANCORA (`atleti`, la lista già filtrata da RLS e `deleted_at`). Un id
// rimasto nell'array dopo una cancellazione o un cambio di coach non si mostra,
// non si conta e non si assegna.

export const NOME_MAX = 40

const normale = (s) => String(s ?? '').trim().toLocaleLowerCase('it')

/** `null` se il nome va bene, altrimenti il messaggio da mostrare. */
export function nomeGruppoValido(nome, gruppi = [], idEscluso = null) {
  const pulito = String(nome ?? '').trim()
  if (!pulito) return 'Scrivi un nome.'
  if (pulito.length > NOME_MAX) return `Massimo ${NOME_MAX} caratteri.`
  if (gruppi.some(g => g.id !== idEscluso && normale(g.nome) === normale(pulito))) {
    return 'Hai già un gruppo con questo nome.'
  }
  return null
}

/** Gli atleti del gruppo che il coach vede ancora, nell'ordine di `atleti`. */
export function membriVisibili(gruppo, atleti = []) {
  const ids = new Set(Array.isArray(gruppo?.atleti) ? gruppo.atleti : [])
  return atleti.filter(a => ids.has(a.id))
}

/** 'vuoto' (nessun membro visibile) | 'nessuno' | 'alcuni' | 'tutti' già scelti. */
export function statoGruppo(gruppo, scelti = [], atleti = []) {
  const membri = membriVisibili(gruppo, atleti)
  if (membri.length === 0) return 'vuoto'
  const sceltiIds = new Set(scelti.map(s => s.id))
  const dentro = membri.filter(m => sceltiIds.has(m.id)).length
  return dentro === 0 ? 'nessuno' : dentro === membri.length ? 'tutti' : 'alcuni'
}

/**
 * Il tocco su un gruppo: se i suoi membri erano già TUTTI scelti li toglie,
 * altrimenti aggiunge in coda quelli che mancano. Chi è stato scelto a mano
 * fuori dal gruppo non si tocca mai.
 */
export function alternaGruppo(gruppo, scelti = [], atleti = []) {
  const stato = statoGruppo(gruppo, scelti, atleti)
  if (stato === 'vuoto') return scelti
  const membri = membriVisibili(gruppo, atleti)
  if (stato === 'tutti') {
    const ids = new Set(membri.map(m => m.id))
    return scelti.filter(s => !ids.has(s.id))
  }
  const sceltiIds = new Set(scelti.map(s => s.id))
  return [...scelti, ...membri.filter(m => !sceltiIds.has(m.id))]
}

/** Il gruppo che ha esattamente questi membri visibili, o `null`. */
export function gruppoUguale(gruppi = [], ids = [], atleti = []) {
  const voluti = new Set(ids)
  return gruppi.find(g => {
    const membri = membriVisibili(g, atleti)
    return membri.length === voluti.size && membri.every(m => voluti.has(m.id))
  }) ?? null
}

/** I gruppi che contengono questo atleta (scheda atleta, 16/11/2026). */
export function gruppiDi(gruppi = [], atletaId) {
  return gruppi.filter(g => Array.isArray(g?.atleti) && g.atleti.includes(atletaId))
}

/**
 * L'array `atleti` del gruppo con questo atleta dentro (in coda, una volta
 * sola) o fuori. Gli altri id restano come sono: dalla scheda atleta non si
 * sa chi il coach vede ancora, e la pulizia la fa l'editor di FoglioGruppi.
 */
export function conAtleta(gruppo, atletaId, dentro) {
  const ids = (Array.isArray(gruppo?.atleti) ? gruppo.atleti : []).filter(id => id !== atletaId)
  return dentro ? [...ids, atletaId] : ids
}
