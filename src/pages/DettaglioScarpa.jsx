// DettaglioScarpa.jsx — «/scarpe/:id» (02/11/2026, spec §2).
// Solo l'atleta apre le SUE scarpe: uno staff, o un id che non sta nella sua
// lista, vede «Scarpa non trovata». Tabelle assenti: stesso messaggio, mai un alert.
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../App'
import { DettaglioScarpaUI } from '../components/ScarpeUI'
import { CustomConfirm } from '../components/CustomModals'
import { aggiornaScarpa, leggiScarpeAtleta, numeroKm, ritiraScarpa, rendiPrincipale } from '../lib/scarpeDb'
import { mostraErrore } from '../lib/alert'
import { vibraSuccesso } from '../lib/aptica'
import { VETRO } from '../lib/stiliCard'
import { useIndietro } from '../useIndietro'

const SENZA_RETE = 'Controlla la connessione e riprova.'

export default function DettaglioScarpa() {
  const { id } = useParams()
  const { role, user } = useAuth() || {}
  const uid = user?.id
  const atleta = role === 'athlete'
  const indietro = useIndietro('/scarpe')
  const [stato, setStato] = useState('caricamento') // 'caricamento' | 'pronto' | 'assente' | 'errore'
  const [scarpa, setScarpa] = useState(null)
  const [soglia, setSoglia] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [conferma, setConferma] = useState(null)

  const carica = useCallback(async () => {
    if (!atleta || !uid) { setStato('assente'); return }
    try {
      const r = await leggiScarpeAtleta(uid)
      const trovata = r?.disponibile ? r.scarpe.find(s => String(s.id) === String(id)) : null
      setScarpa(trovata || null)
      if (trovata) setSoglia(String(trovata.soglia_km ?? ''))
      setStato(trovata ? 'pronto' : 'assente')
    } catch (e) {
      console.warn('Scarpa non caricata:', e)
      setStato('errore')
    }
  }, [atleta, uid, id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento iniziale, come le altre pagine
    carica()
  }, [carica])

  const valore = numeroKm(soglia)
  const sogliaValida = valore !== null && valore > 0

  const salvaSoglia = async () => {
    if (!sogliaValida || salvando) return
    setSalvando(true)
    try {
      await aggiornaScarpa(scarpa.id, { soglia_km: valore })
      vibraSuccesso()
      await carica()
    } catch (e) {
      console.warn('Soglia non salvata:', e)
      mostraErrore(`Non sono riuscito a salvare. ${SENZA_RETE}`)
    }
    setSalvando(false)
  }

  const principale = async () => {
    try {
      await rendiPrincipale(uid, scarpa.id)
      vibraSuccesso()
      await carica()
    } catch (e) {
      console.warn('Scarpa non resa principale:', e)
      mostraErrore(`Non sono riuscito a cambiarla. ${SENZA_RETE}`)
      // La vecchia può essere già stata tolta: si rilegge quello che c'è davvero.
      await carica()
    }
  }

  const chiediRitira = () => setConferma({
    title: 'Ritirare la scarpa?',
    message: `${scarpa.marca} ${scarpa.modello} non verrà più abbinata alle nuove corse. I suoi km restano.`,
    confirmLabel: 'Ritirala',
    onConfirm: async () => {
      try {
        await ritiraScarpa(scarpa.id)
        vibraSuccesso()
        await carica()
      } catch (e) {
        console.warn('Scarpa non ritirata:', e)
        mostraErrore(`Non sono riuscito a ritirarla. ${SENZA_RETE}`)
      }
    },
  })

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 pt-1 bg-[#0B0B0B]/95 backdrop-blur max-w-2xl md:mx-auto">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Torna indietro" onClick={indietro}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-200 hover:text-white transition shrink-0 ${VETRO}`}>
            <ChevronLeft size={19} />
          </button>
          <h1 className="flex-1 min-w-0 text-3xl font-black tracking-tight truncate">Scarpa</h1>
        </div>
      </div>

      {stato === 'assente' && <p className="max-w-2xl mx-auto mt-6 text-center text-[15px] font-bold text-gray-400">Scarpa non trovata</p>}
      {stato === 'errore' && <p role="alert" className="max-w-2xl mx-auto mt-2 text-sm text-red-500">Non riesco a caricare la scarpa.</p>}
      {stato === 'pronto' && scarpa && (
        <DettaglioScarpaUI scarpa={scarpa} soglia={soglia} onSoglia={setSoglia} sogliaValida={sogliaValida}
          salvandoSoglia={salvando} onSalvaSoglia={salvaSoglia} onPrincipale={principale} onRitira={chiediRitira} />
      )}
      {createPortal(<CustomConfirm info={conferma} onClose={() => setConferma(null)} />, document.body)}
    </div>
  )
}
