// FoglioNuovoTeam — «Nuovo team» (06/11/2026, spec §6): nome, la gara se c'è
// (solo gare future), e se la classifica è visibile agli atleti. `onCrea`
// torna un messaggio d'errore da mostrare nel foglio, o null se è andata.
// ⚠️ X «Chiudi» e «Annulla»: il tasto indietro di Android li trova.
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { separaCodice } from '../lib/codiceWorkout'
import { BOTTONE_BRAND, BOTTONE_QUIETO, LABEL } from '../lib/stiliCard'
import { useBottomSheet } from '../useBottomSheet'
import { Foglio } from './FoglioMessaggio'
import { CAMPO_TEAM, CampoTeam, Interruttore } from './TeamUI'

const oggi = () => new Date().toISOString().slice(0, 10)
const eGara = (w) => w?.sections?.category === 'Event' || w?.sections?.isEvent === true

export default function FoglioNuovoTeam({ onCrea, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)
  const [nome, setNome] = useState('')
  const [evento, setEvento] = useState('')
  const [visibile, setVisibile] = useState(false)
  const [gare, setGare] = useState([])
  const [errore, setErrore] = useState(null)
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    let vivo = true
    supabase.from('workouts').select('id, title, date, sections').gte('date', oggi()).order('date')
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) { console.warn('Gare non caricate:', error); return }
        const visti = new Set()
        setGare((data || []).filter((w) => {
          if (!eGara(w) || !w.date || w.date < oggi() || visti.has(w.id)) return false
          visti.add(w.id)
          return true
        }))
      })
    return () => { vivo = false }
  }, [])

  const crea = async () => {
    if (!nome.trim() || invio) return
    setInvio(true)
    setErrore(null)
    const msg = await onCrea({ nome: nome.trim(), evento_id: evento || null, classifica_visibile: visibile })
    if (msg) { setErrore(msg); setInvio(false) }
    else sheet.chiudi()
  }

  return (
    <Foglio titolo="Nuovo team" {...sheet}>
      <div className="flex flex-col gap-3.5 pb-1">
        <CampoTeam etichetta="Nome del team" valore={nome} onChange={(v) => { setNome(v); setErrore(null) }}
          maxLength={60} placeholder="Es. Doppia Hyrox Milano" errore={errore} />
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Gara (facoltativa)</span>
          <select aria-label="Gara (facoltativa)" value={evento} onChange={e => setEvento(e.target.value)} className={CAMPO_TEAM}>
            <option value="">Nessuna gara</option>
            {gare.map(g => <option key={g.id} value={g.id}>{`${separaCodice(g.title || '').nome || g.title} · ${g.date}`}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-white">Classifica visibile agli atleti</span>
            <span className="block text-[12.5px] font-medium text-muted">
              Se è accesa, i compagni vedono i risultati di tutti. Lo sanno prima di accettare.
            </span>
          </span>
          <Interruttore etichetta="Classifica visibile agli atleti" attivo={visibile} onCambia={() => setVisibile(v => !v)} />
        </div>
        <div className="flex gap-3 mt-1">
          <button type="button" onClick={sheet.chiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={crea} disabled={!nome.trim() || invio} className={BOTTONE_BRAND}>Crea</button>
        </div>
      </div>
    </Foglio>
  )
}
