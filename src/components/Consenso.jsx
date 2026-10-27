import { useState } from 'react'
import { Check } from 'lucide-react'
import { apriInformativa } from '../lib/informativa'

/**
 * La schermata del consenso: dopo l'accesso (e il codice invito), prima
 * dell'onboarding. Solo atleti — `serveConsenso` di src/lib/consenso.js.
 *
 * 🔴 Le caselle partono VUOTE e il bottone si accende solo con entrambe: un
 * consenso pre-spuntato non è un consenso (GDPR art. 4.11), e per Apple 5.1.2(i)
 * il permesso all'IA di terze parti deve essere esplicito e precedere l'invio.
 *
 * ⚠️ Il testo della seconda casella è ciò che l'atleta accetta: se cambia nella
 * sostanza, va alzata VERSIONE_CONSENSO (src/lib/consenso.js).
 *
 * Il componente non parla con Supabase: `onAccetta` e `onRifiuta` li passa
 * `ProtectedRoute`, che sa cosa fare dopo.
 */
export default function Consenso({ onAccetta, onRifiuta }) {
  const [letto, setLetto] = useState(false)
  const [acconsento, setAcconsento] = useState(false)
  const [invio, setInvio] = useState(false)

  const accetta = async () => {
    setInvio(true)
    try { await onAccetta() } finally { setInvio(false) }
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      <div className="w-full max-w-md bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-4xl font-black text-white tracking-tight mb-3">FLEO<span className="text-brand">FIT</span></h1>
          <h2 className="text-2xl font-bold text-white text-center">I tuoi dati</h2>
          <p className="text-gray-400 text-sm mt-2 text-center leading-relaxed">
            Per seguirti, il tuo coach usa dati sul tuo allenamento e sulla tua salute,
            anche con l'aiuto dell'intelligenza artificiale. Prima di entrare ci serve il tuo permesso.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Casella spuntata={letto} onCambia={setLetto}>
            Ho letto l'{' '}
            <button type="button" onClick={(e) => { e.preventDefault(); apriInformativa() }}
              className="text-brand font-semibold underline underline-offset-2">
              informativa privacy
            </button>
          </Casella>
          <Casella spuntata={acconsento} onCambia={setAcconsento}>
            Acconsento al trattamento dei miei dati sull'allenamento e sulla salute (fatica percepita,
            sensazioni, «Come stai oggi», peso, note scritte e vocali) per il servizio di coaching,
            anche con strumenti di intelligenza artificiale di fornitori esterni, come descritto nell'informativa.
          </Casella>
        </div>

        <p className="text-muted text-xs mt-4 leading-relaxed">
          Puoi ritirare il consenso quando vuoi da Impostazioni. Senza consenso non puoi usare FLEOFIT.
        </p>

        <button type="button" onClick={accetta} disabled={!letto || !acconsento || invio}
          className="w-full mt-5 py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-40 flex justify-center items-center">
          {invio ? 'Un attimo…' : 'Accetto ed entra'}
        </button>
        <button type="button" onClick={onRifiuta} disabled={invio}
          className="w-full mt-2 py-3 text-gray-400 font-semibold rounded-xl hover:text-white transition disabled:opacity-40">
          Non accetto
        </button>
      </div>
    </div>
  )
}

function Casella({ spuntata, onCambia, children }) {
  return (
    <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition
                       ${spuntata ? 'bg-brand/10 border-brand/40' : 'bg-[#111] border-[#333]'}`}>
      <input type="checkbox" checked={spuntata} onChange={(e) => onCambia(e.target.checked)} className="sr-only peer" />
      <span aria-hidden="true"
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition
                    peer-focus-visible:ring-2 peer-focus-visible:ring-brand
                    ${spuntata ? 'bg-brand border-brand' : 'border-[#555]'}`}>
        {spuntata && <Check size={14} strokeWidth={3} className="text-black" />}
      </span>
      <span className="text-sm text-gray-200 leading-relaxed">{children}</span>
    </label>
  )
}
