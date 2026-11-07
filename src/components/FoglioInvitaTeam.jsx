// FoglioInvitaTeam — «Invita» nella scheda del team (06/11/2026, spec §5).
// Propone solo gli atleti del coach (la RLS di `athletes` dà solo i suoi) che
// non sono già dentro o invitati, non in pausa, non eliminati; chi ha
// rifiutato o è uscito torna proponibile dopo GIORNI_REINVITO.
// ⚠️ X «Chiudi» e «Annulla»: il tasto indietro di Android li trova.
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { invitabili } from '../lib/membriTeam'
import { BOTTONE_BRAND, BOTTONE_QUIETO } from '../lib/stiliCard'
import { useBottomSheet } from '../useBottomSheet'
import { Foglio } from './FoglioMessaggio'
import { Avatar } from './TeamUI'

export default function FoglioInvitaTeam({ membri, coachId, onInvita, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)
  const [atleti, setAtleti] = useState(null)
  const [scelti, setScelti] = useState([])
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    let vivo = true
    supabase.from('athletes').select('id, name, surname, photo_url, notes, deleted_at').order('name')
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) { console.warn('Atleti non caricati:', error); setAtleti([]); return }
        setAtleti(invitabili(data, membri, coachId))
      })
    return () => { vivo = false }
  }, [membri, coachId])

  const cambia = (id) => setScelti(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  const invia = async () => {
    if (!scelti.length || invio) return
    setInvio(true)
    const ok = await onInvita(scelti)
    if (ok) sheet.chiudi()
    else setInvio(false)
  }
  const testo = scelti.length === 1 ? 'Invita 1 atleta' : `Invita ${scelti.length} atleti`

  return (
    <Foglio titolo="Invita nel team" {...sheet}>
      <div className="flex flex-col gap-3 pb-1">
        <p className="text-[13px] text-gray-400 leading-relaxed">
          Ogni atleta riceve una notifica e decide lui se entrare.
        </p>
        {atleti && atleti.length === 0 && (
          <p className="text-[14px] text-gray-400 py-4 text-center">Nessun altro atleta da invitare.</p>
        )}
        {atleti && atleti.length > 0 && (
          <ul className="flex flex-col gap-1.5 max-h-[45dvh] overflow-y-auto">
            {atleti.map((a) => {
              const nome = `${a.name || ''} ${a.surname || ''}`.trim()
              return (
                <li key={a.id}>
                  <label className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/[.04] cursor-pointer">
                    <Avatar foto={a.photo_url} nome={a.name} cognome={a.surname} dimensione={36} />
                    <span className="flex-1 min-w-0 text-[15px] font-bold text-white truncate">{nome}</span>
                    <input type="checkbox" aria-label={nome} checked={scelti.includes(a.id)} onChange={() => cambia(a.id)}
                      className="w-5 h-5 accent-[var(--color-brand)]" />
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex gap-3 mt-1">
          <button type="button" onClick={sheet.chiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={invia} disabled={!scelti.length || invio} className={BOTTONE_BRAND}>
            {scelti.length ? testo : 'Invita'}
          </button>
        </div>
      </div>
    </Foglio>
  )
}
