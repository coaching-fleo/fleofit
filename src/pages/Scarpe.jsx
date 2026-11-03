// Scarpe.jsx — «Scarpe da corsa» (02/11/2026, spec §2,
// docs/superpowers/specs/2026-11-02-scarpe-design.md).
// Due facce sulla stessa rotta:
//   · atleta: «Le mie scarpe» (le attive, poi le ritirate chiuse) e il catalogo
//     con «Ce l'ho»; «Non la trovi? Scrivila tu» per una scarpa che non c'è;
//   · staff (coach/admin): lo stesso catalogo da curare (aggiungi, modifica,
//     elimina con CustomConfirm) e «Scritte dagli atleti», le scarpe scritte a
//     mano, raggruppate, con «Aggiungi al catalogo».
// Il ruolo viene dal contesto: un admin che simula l'atleta (adminRoleOverride)
// ha già `role === 'athlete'` e vede la faccia dell'atleta.
// Tabelle assenti (migrazione non applicata): stato vuoto, MAI un alert.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronDown, Footprints, Plus, PenLine } from 'lucide-react'
import { useAuth } from '../App'
import {
  CardScarpa, Filtro, FoglioScarpa, ListaCatalogo, ListaScritte,
} from '../components/ScarpeUI'
import { FoglioModelloCatalogo } from '../components/FoglioModelloCatalogo'
import { TIPI_SCARPA } from '../lib/kmScarpe'
import { CustomConfirm } from '../components/CustomModals'
import {
  aggiornaModelloCatalogo, aggiungiScarpa, caricaFotoModello, elencoCatalogo, eliminaModelloCatalogo, leggiScarpeAtleta,
  rendiPrincipale, salvaModelloCatalogo, scritteDagliAtleti, tabelleAssenti,
} from '../lib/scarpeDb'
import { mostraErrore } from '../lib/alert'
import { vibraScelta, vibraSuccesso } from '../lib/aptica'
import { LABEL, VETRO } from '../lib/stiliCard'
import { useIndietro } from '../useIndietro'
import { useNavigate } from 'react-router-dom'

const SENZA_RETE = 'Controlla la connessione e riprova.'
const chiave = (t) => String(t ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/** Un errore di Supabase per un modello che c'è già (indice unico su marca/modello). */
const doppione = (e) => e?.code === '23505'
/** La policy del catalogo ha detto no (42501): non è la rete, non va detto «riprova». */
const negato = (e) => e?.code === '42501'
const NEGATO = 'Il catalogo non si modifica da questo account.'
/**
 * L'account del revisore App Store: è admin, ma la policy «scarpe_catalogo staff»
 * lo esclude dalle scritture. Niente tasti che fallirebbero.
 */
const ACCOUNT_REVISORE = 'demo@fleofit.it'

export default function Scarpe() {
  const { role, user } = useAuth() || {}
  const staff = role !== 'athlete'
  const uid = user?.id
  // Lo staff cura il catalogo, tranne l'account del revisore (sola lettura).
  const curaCatalogo = staff && String(user?.email ?? '').trim().toLowerCase() !== ACCOUNT_REVISORE
  const indietro = useIndietro(staff ? '/settings' : '/profile')
  const navigate = useNavigate()

  // stato: 'caricamento' | 'pronto' | 'assente' (tabelle mancanti) | 'errore'
  const [stato, setStato] = useState('caricamento')
  const [mie, setMie] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [scritte, setScritte] = useState([])
  const [ritirateAperte, setRitirateAperte] = useState(false)
  const [filtroMarca, setFiltroMarca] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState(null)
  const [foglioScarpa, setFoglioScarpa] = useState(null)     // { modello } | { modello: null }
  const [foglioModello, setFoglioModello] = useState(null)   // { iniziale }
  const [conferma, setConferma] = useState(null)

  const carica = useCallback(async () => {
    try {
      if (staff) {
        const [cat, scr] = await Promise.all([
          elencoCatalogo(),
          // Le scritte sono un aiuto: se non arrivano, il catalogo resta.
          scritteDagliAtleti().catch((e) => { console.warn('Scritte dagli atleti non caricate:', e); return [] }),
        ])
        setCatalogo(cat)
        setScritte(scr)
        setStato('pronto')
      } else {
        const [scarpe, cat] = await Promise.all([leggiScarpeAtleta(uid), elencoCatalogo()])
        if (!scarpe.disponibile) { setStato('assente'); return }
        setMie(scarpe.scarpe)
        setCatalogo(cat)
        setStato('pronto')
      }
    } catch (e) {
      console.warn('Scarpe non caricate:', e)
      setStato(tabelleAssenti(e) ? 'assente' : 'errore')
    }
  }, [staff, uid])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento iniziale, come le altre pagine
    carica()
  }, [carica])

  const attive = useMemo(() => mie.filter(s => !s.ritirata_at)
    .sort((a, b) => Number(b.principale) - Number(a.principale)), [mie])
  const ritirate = useMemo(() => mie.filter(s => s.ritirata_at), [mie])
  const marche = useMemo(() => [...new Set(catalogo.map(m => m.marca))], [catalogo])
  const filtrato = catalogo.filter(m => (!filtroMarca || m.marca === filtroMarca) && (!filtroTipo || m.tipo === filtroTipo))
  // Una scritta già nel catalogo non serve più al coach (le scarpe degli atleti restano come sono).
  const nelCatalogo = new Set(catalogo.map(m => `${chiave(m.marca)}|${chiave(m.modello)}`))
  const scritteNuove = scritte.filter(g => !nelCatalogo.has(`${chiave(g.marca)}|${chiave(g.modello)}`))

  // ── Atleta ────────────────────────────────────────────────────────────────

  const aggiungi = async (modello, { marca, modello: nomeModello, kmIniziali, principale }) => {
    let nuova
    try {
      nuova = await aggiungiScarpa({
        athleteId: uid,
        ...(modello ? { catalogo: modello } : { marca, modello: nomeModello }),
        kmIniziali,
        principale: false,
      })
    } catch (e) {
      console.warn('Scarpa non aggiunta:', e)
      mostraErrore(`Non sono riuscito a salvarla. ${SENZA_RETE}`)
      return false
    }
    // Principale in un secondo passo: se fallisce la scarpa c'è comunque, e va detto.
    if (principale) {
      try {
        await rendiPrincipale(uid, nuova.id)
      } catch (e) {
        console.warn('Scarpa non resa principale:', e)
        mostraErrore('La scarpa è salvata, ma non sono riuscito a renderla principale. Riprova più tardi.', 'Quasi fatto')
        carica()
        return true
      }
    }
    vibraSuccesso()
    carica()
    return true
  }

  // ── Staff ─────────────────────────────────────────────────────────────────

  const salvaModello = async (iniziale, campi) => {
    try {
      if (iniziale?.id) await aggiornaModelloCatalogo(iniziale.id, campi)
      else await salvaModelloCatalogo(campi)
    } catch (e) {
      console.warn('Modello non salvato:', e)
      mostraErrore(doppione(e) ? 'Questo modello c\'è già nel catalogo.'
        : negato(e) ? NEGATO : `Non sono riuscito a salvarlo. ${SENZA_RETE}`)
      return false
    }
    vibraSuccesso()
    carica()
    return true
  }

  const chiediElimina = (m) => {
    vibraScelta()
    setConferma({
      title: 'Togliere il modello?',
      message: `${m.marca} ${m.modello} sparisce dal catalogo. Gli atleti che la usano la tengono, con i loro km.`,
      confirmLabel: 'Elimina',
      onConfirm: async () => {
        try {
          await eliminaModelloCatalogo(m.id)
          setCatalogo(c => c.filter(x => x.id !== m.id))
        } catch (e) {
          console.warn('Modello non eliminato:', e)
          mostraErrore(negato(e) ? NEGATO : `Non sono riuscito a toglierlo. ${SENZA_RETE}`)
        }
      },
    })
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      {/* La testata è cornice: sta ferma, fuori dalla cascata. */}
      <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 pt-1 bg-[#0B0B0B]/95 backdrop-blur max-w-2xl md:mx-auto">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Torna indietro" onClick={indietro}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-200 hover:text-white transition shrink-0 ${VETRO}`}>
            <ChevronLeft size={19} />
          </button>
          <h1 className="flex-1 min-w-0 text-3xl font-black tracking-tight truncate">Scarpe</h1>
          {curaCatalogo && stato === 'pronto' && (
            <button type="button" onClick={() => setFoglioModello({ iniziale: null })}
              className="shrink-0 min-h-[40px] inline-flex items-center gap-1 rounded-full bg-brand text-black px-4 text-[14px] font-extrabold hover:brightness-110 transition">
              <Plus size={17} aria-hidden="true" />Aggiungi modello
            </button>
          )}
        </div>
      </div>

      {stato === 'assente' && (
        <div className="cascata max-w-2xl mx-auto mt-2">
          <div className="rounded-3xl border border-dashed border-[#333] px-6 py-10 flex flex-col items-center gap-4 text-center">
            <span className="w-14 h-14 rounded-full bg-[#1e1e1e] flex items-center justify-center text-gray-500">
              <Footprints size={24} aria-hidden="true" />
            </span>
            <p className="text-[14px] text-gray-400 leading-relaxed max-w-xs">
              Le scarpe non sono ancora disponibili. Arrivano con un prossimo aggiornamento.
            </p>
          </div>
        </div>
      )}
      {stato === 'errore' && (
        <p role="alert" className="max-w-2xl mx-auto mt-2 text-sm text-red-500">Non riesco a caricare le scarpe.</p>
      )}

      {stato === 'pronto' && (
        <div className="cascata max-w-2xl mx-auto flex flex-col gap-6 mt-2">
          {!staff && (
            <section aria-label="Le mie scarpe" className="flex flex-col gap-2.5">
              <h2 className={`${LABEL} px-1`}>Le mie scarpe</h2>
              {attive.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-[#333] px-5 py-6 text-[14px] text-gray-400 leading-relaxed text-center">
                  Nessuna scarpa. Scegli dal catalogo quella che usi, e i km si contano da soli.
                </p>
              ) : attive.map(s => <CardScarpa key={s.id} scarpa={s} onApri={() => navigate(`/scarpe/${s.id}`)} />)}
              {ritirate.length > 0 && (
                <>
                  <button type="button" aria-expanded={ritirateAperte} onClick={() => setRitirateAperte(v => !v)}
                    className="self-start min-h-10 px-1 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-muted hover:text-white">
                    {`Ritirate (${ritirate.length})`}
                    <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${ritirateAperte ? 'rotate-180' : ''}`} />
                  </button>
                  {ritirateAperte && ritirate.map(s => <CardScarpa key={s.id} scarpa={s} onApri={() => navigate(`/scarpe/${s.id}`)} />)}
                </>
              )}
            </section>
          )}

          <section aria-label="Catalogo scarpe" className="flex flex-col gap-2.5">
            <h2 className={`${LABEL} px-1`}>Catalogo</h2>
            <div className="-mx-4 px-4 flex gap-2 overflow-x-auto hide-scrollbar" aria-label="Marca" role="group">
              <Filtro attivo={!filtroMarca} onClick={() => setFiltroMarca(null)}>Tutte le marche</Filtro>
              {marche.map(m => (
                <Filtro key={m} attivo={filtroMarca === m} onClick={() => setFiltroMarca(v => (v === m ? null : m))}>{m}</Filtro>
              ))}
            </div>
            <div className="-mx-4 px-4 flex gap-2 overflow-x-auto hide-scrollbar" aria-label="Tipo" role="group">
              <Filtro attivo={!filtroTipo} onClick={() => setFiltroTipo(null)}>Tutti i tipi</Filtro>
              {TIPI_SCARPA.map(t => (
                <Filtro key={t.valore} attivo={filtroTipo === t.valore}
                  onClick={() => setFiltroTipo(v => (v === t.valore ? null : t.valore))}>{t.etichetta}</Filtro>
              ))}
            </div>
            {filtrato.length === 0 ? (
              <p className="px-1 text-[14px] text-gray-400">Nessun modello con questi filtri.</p>
            ) : (
              <ListaCatalogo modelli={filtrato} staff={staff}
                onApri={(m) => navigate(`/scarpe/modello/${m.id}`)}
                onCeLho={(m) => { vibraScelta(); setFoglioScarpa({ modello: m }) }}
                onModifica={curaCatalogo ? (m) => setFoglioModello({ iniziale: m }) : null}
                onElimina={curaCatalogo ? chiediElimina : null} />
            )}
            {!staff && (
              <button type="button" onClick={() => setFoglioScarpa({ modello: null })}
                className="self-start min-h-10 px-1 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-muted hover:text-white">
                <PenLine size={15} aria-hidden="true" />Non la trovi? Scrivila tu
              </button>
            )}
          </section>

          {staff && scritteNuove.length > 0 && (
            <section aria-label="Scritte dagli atleti" className="flex flex-col gap-2.5">
              <h2 className={`${LABEL} px-1`}>Scritte dagli atleti</h2>
              <ListaScritte gruppi={scritteNuove}
                onAggiungi={curaCatalogo ? (g) => setFoglioModello({ iniziale: { marca: g.marca, modello: g.modello } }) : null} />
            </section>
          )}
        </div>
      )}

      {foglioScarpa && (
        <FoglioScarpa modello={foglioScarpa.modello}
          principaleDiBase={!attive.some(s => s.principale)}
          onSalva={(dati) => aggiungi(foglioScarpa.modello, dati)}
          onChiudi={() => setFoglioScarpa(null)} />
      )}
      {foglioModello && (
        <FoglioModelloCatalogo iniziale={foglioModello.iniziale}
          onSalva={(campi) => salvaModello(foglioModello.iniziale, campi)}
          onCaricaFoto={foglioModello.iniziale?.id ? async (ridotta) => {
            await caricaFotoModello(foglioModello.iniziale.id, ridotta)
            carica()
          } : undefined}
          onChiudi={() => setFoglioModello(null)} />
      )}
      {createPortal(<CustomConfirm info={conferma} onClose={() => setConferma(null)} />, document.body)}
    </div>
  )
}
