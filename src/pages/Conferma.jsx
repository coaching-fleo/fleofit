// La pagina dei link delle mail: conferma dell'iscrizione e reset della
// password (src/lib/confermaLink.js spiega il perché, 18/11/2026).
// ⚠️ Pubblica: chi la apre di solito non ha una sessione, e spesso la apre su
// un altro dispositivo rispetto a quello dell'app.
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import Logo from '../components/Logo'
import { clientVerifica } from '../supabaseClient'
import { leggiLinkConferma, ritornoSicuro, ritornoConSessione, ritornoConErrore, testiConferma } from '../lib/confermaLink'
import { messaggioErroreLink } from '../lib/esitoLink'

export default function Conferma() {
  const [link] = useState(() => leggiLinkConferma(window.location.search))
  const [stato, setStato] = useState(link.tokenHash && link.tipo ? 'pronto' : 'errore')
  const [errore, setErrore] = useState(null)
  const ritorno = ritornoSicuro(link.torna, window.location.origin)
  const testi = testiConferma(link.tipo)
  const nativo = /^[a-z]+:\/\/login-callback/i.test(ritorno) && !ritorno.startsWith('http')

  // Si verifica solo al TOCCO, mai all'apertura: l'antivirus della posta apre
  // i link per controllarli, e consumerebbe il codice prima della persona.
  async function conferma() {
    setStato('verifica')
    const tipo = link.tipo === 'signup' ? 'email' : link.tipo
    const { data, error } = await clientVerifica().auth.verifyOtp({ token_hash: link.tokenHash, type: tipo })
    if (error || !data?.session) {
      if (nativo) { window.location.assign(ritornoConErrore(ritorno, error)); return }
      setErrore(messaggioErroreLink({ codice: 'otp_expired' }))
      setStato('errore')
      return
    }
    setStato('fatto')
    window.location.assign(ritornoConSessione(ritorno, data.session, link.tipo === 'recovery' ? 'recovery' : 'signup'))
  }

  const titolo = stato === 'errore' ? (errore?.title || 'Link non valido') : stato === 'fatto' ? 'Fatto' : testi.titolo
  const testo = stato === 'errore'
    ? (errore?.message || 'Questo link non è completo. Chiedi una mail nuova dalla schermata di accesso.')
    : stato === 'fatto'
      ? (nativo ? 'Ti stiamo riportando nell\'app. Se non si apre, apri l\'app a mano.' : 'Un attimo, ti stiamo portando avanti…')
      : testi.testo

  return (
    <main className="min-h-screen bg-[#0B0B0B] text-white flex items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      style={{ background: 'radial-gradient(120% 45% at 50% 0%,#17160f 0%,#0B0B0B 58%)' }}>
      <div className="w-full max-w-sm text-center modal-transition">
        <Logo altezza={30} className="mx-auto mb-10" />
        <h1 className="text-2xl font-black tracking-tight">{titolo}</h1>
        <p className="mt-3 text-gray-400 leading-relaxed">{testo}</p>
        {(stato === 'pronto' || stato === 'verifica') && (
          <button type="button" onClick={conferma} disabled={stato === 'verifica'}
            className="mt-8 w-full h-14 rounded-2xl bg-brand text-black font-bold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-70">
            {stato === 'verifica' ? <Loader2 size={20} className="animate-spin" aria-label="Verifica in corso" /> : testi.bottone}
          </button>
        )}
        {stato === 'errore' && (
          <a href="/login" className="mt-8 w-full h-14 rounded-2xl bg-[#2a2a2a] text-white font-bold flex items-center justify-center">
            Torna all'accesso
          </a>
        )}
      </div>
    </main>
  )
}
