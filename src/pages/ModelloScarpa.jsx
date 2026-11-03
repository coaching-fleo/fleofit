// ModelloScarpa.jsx — «/scarpe/modello/:id»: la scheda di un modello del
// catalogo, la stessa per tutti. L'atleta ha «Ce l'ho» (aggiunge la scarpa con
// la soglia che viene da `vita_km`), il coach «Modifica» e «Carica foto»;
// l'account del revisore (demo@fleofit.it) solo lettura.
// Tabelle assenti: «Modello non trovato», mai un alert.
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { useAuth } from '../App'
import { SchedaModelloUI, TestataModello } from '../components/ModelloScarpaUI'
import { FoglioScarpa } from '../components/ScarpeUI'
import { FoglioModelloCatalogo } from '../components/FoglioModelloCatalogo'
import { aggiornaModelloCatalogo, aggiungiScarpa, caricaFotoModello, leggiModello } from '../lib/scarpeDb'
import { riduciFoto } from '../lib/fotoScarpa'
import { mostraErrore } from '../lib/alert'
import { vibraSuccesso } from '../lib/aptica'
import { useIndietro } from '../useIndietro'

const SENZA_RETE = 'Controlla la connessione e riprova.'
const ACCOUNT_REVISORE = 'demo@fleofit.it'

function apriUrl(url) {
  if (Capacitor.isNativePlatform()) return Browser.open({ url }).catch(() => {})
  window.open(url, '_blank', 'noopener')
  return Promise.resolve()
}

export default function ModelloScarpa() {
  const { id } = useParams()
  const { role, user } = useAuth() || {}
  const staff = role !== 'athlete'
  const curaCatalogo = staff && String(user?.email ?? '').trim().toLowerCase() !== ACCOUNT_REVISORE
  const indietro = useIndietro('/scarpe')
  const navigate = useNavigate()
  const [stato, setStato] = useState('caricamento') // 'caricamento' | 'pronto' | 'assente'
  const [modello, setModello] = useState(null)
  const [foglioScarpa, setFoglioScarpa] = useState(false)
  const [foglioModello, setFoglioModello] = useState(false)

  useEffect(() => {
    let vivo = true
    leggiModello(id)
      .then(m => { if (vivo) { setModello(m); setStato(m ? 'pronto' : 'assente') } })
      .catch(e => { console.warn('Modello non caricato:', e); if (vivo) setStato('assente') })
    return () => { vivo = false }
  }, [id])

  const aggiungi = async ({ kmIniziali, principale }) => {
    try {
      await aggiungiScarpa({ athleteId: user?.id, catalogo: modello, kmIniziali, principale })
    } catch (e) {
      console.warn('Scarpa non aggiunta:', e)
      mostraErrore(`Non sono riuscito a salvarla. ${SENZA_RETE}`)
      return false
    }
    vibraSuccesso()
    navigate('/scarpe')
    return true
  }

  const salvaModifica = async (campi) => {
    try {
      const nuovo = await aggiornaModelloCatalogo(modello.id, campi)
      setModello(m => ({ ...m, ...nuovo }))
    } catch (e) {
      console.warn('Modello non salvato:', e)
      mostraErrore(e?.code === '42501' ? 'Il catalogo non si modifica da questo account.'
        : e?.code === '23505' ? 'Questo modello c\'è già nel catalogo.'
        : `Non sono riuscito a salvarlo. ${SENZA_RETE}`)
      return false
    }
    vibraSuccesso()
    return true
  }

  // La foto: riduzione, upload e `foto_url` nuovo nel modello mostrato (senza ricaricare).
  const caricaFoto = async (ridotta) => {
    const foto_url = await caricaFotoModello(modello.id, ridotta)
    setModello(m => ({ ...m, foto_url }))
    return foto_url
  }
  const caricaDallaScheda = async (file) => {
    try {
      await caricaFoto(await riduciFoto(file))
      vibraSuccesso()
    } catch (e) {
      console.warn('Foto non caricata:', e)
      mostraErrore(`Non sono riuscito a caricare la foto. ${SENZA_RETE}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      <TestataModello onIndietro={indietro} />
      {stato === 'assente' && (
        <p className="cascata max-w-2xl mx-auto mt-2 px-1 text-[14px] text-gray-400">Modello non trovato</p>
      )}
      {stato === 'pronto' && modello && (
        <SchedaModelloUI modello={modello} staff={staff} curaCatalogo={curaCatalogo}
          onCeLho={() => setFoglioScarpa(true)}
          onModifica={() => setFoglioModello(true)}
          onCaricaFoto={caricaDallaScheda}
          onPaginaUfficiale={() => apriUrl(modello.url_ufficiale)} />
      )}
      {foglioScarpa && modello && (
        <FoglioScarpa modello={modello} onSalva={aggiungi} onChiudi={() => setFoglioScarpa(false)} />
      )}
      {foglioModello && modello && (
        <FoglioModelloCatalogo iniziale={modello} onSalva={salvaModifica} onCaricaFoto={caricaFoto}
          onChiudi={() => setFoglioModello(false)} />
      )}
    </div>
  )
}
