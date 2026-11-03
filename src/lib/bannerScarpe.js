// Il testo e la foto del banner «Scarpe» in Home (logica pura, senza dati da
// leggere: li passa BannerScarpe). Atleta: la scarpa da cambiare, altrimenti
// la principale, altrimenti un invito. Coach: il catalogo.

import { testoKm } from './kmScarpe'

const conFoto = (catalogo) => (catalogo || [])
  .filter((m) => m.foto_url)
  .sort((a, b) => `${a.marca} ${a.modello}`.localeCompare(`${b.marca} ${b.modello}`, 'it'))[0] || null

export function contenutoBanner({ ruolo, scarpe = [], catalogo = [] }) {
  if (ruolo === 'coach') {
    const cat = catalogo || []
    if (!cat.length) return null
    const m = conFoto(cat)
    return { titolo: `Il catalogo scarpe · ${cat.length} modelli`, bottone: 'Apri',
      foto: m?.foto_url || null, tipo: m?.tipo || 'allenamento' }
  }

  const attive = (scarpe || []).filter((s) => !s.ritirata_at)
  const scelta = attive.find((s) => s.stato === 'oltre')
  const modelloDi = (s) => (catalogo || []).find((m) => m.id === s.catalogo_id)
  const datiFoto = (s) => {
    const m = s.catalogo_id ? modelloDi(s) : null
    return { foto: m?.foto_url || null, tipo: m?.tipo || 'allenamento' }
  }

  if (scelta) return { titolo: `${scelta.modello} è da cambiare`, bottone: 'Scegli la nuova', ...datiFoto(scelta) }
  const s = attive.find((x) => x.principale) || attive[0]
  if (s) return { titolo: `${s.modello} · ${testoKm(s.km)} km`, bottone: 'Le mie scarpe', ...datiFoto(s) }

  const m = conFoto(catalogo)
  return { titolo: 'Tieni il conto dei km delle tue scarpe', bottone: 'Aggiungi la tua',
    foto: m?.foto_url || null, tipo: 'allenamento' }
}
