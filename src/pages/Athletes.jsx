// La rubrica atleti — rework del 31/08/2026, artboard `Atleti.dc.html` 1b.
//
// Il problema in una riga: era una rubrica, non uno strumento di lavoro. Ogni
// riga mostrava nome, peso, altezza ed età — dati anagrafici, che si
// consultano una volta al mese — mentre il coach apre questa schermata per
// sapere chi sta seguendo il piano e chi si è fermato, e quella informazione
// non c'era: bisognava entrare in ogni scheda, una per una.
//
// Come per gli altri sei schermi ridisegnati: NESSUN campo di Supabase cambia
// forma. Cambia il JSX, cambia l'ordine, e la pagina fa una seconda lettura —
// una sola query in più — per poter dire un numero.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format, startOfDay, subDays } from 'date-fns'
import { supabase } from '../supabaseClient'
import { User } from 'lucide-react'
import { useAuth } from '../App'
import { COACHING_ID } from '../lib/constants'
import { inPausa } from '../lib/pausa'
import { mostraErrore, mostraSuccesso } from '../lib/alert'
import { atletiFermi, GIORNI_FERMO, FINESTRA_STORICO } from '../lib/statisticheCoach'
import {
  settimanaDi, aderenzaSettimana, NESSUNA_ADERENZA, metaAtleta, nomeAtleta,
  iniziali, etichettaPausa, giorniRimastiCestino, conteggiStato, filtraPerNome,
  GIORNI_CESTINO,
} from '../lib/rigaAtleta'
import { CampoRicerca, IntestazioneSezione } from '../components/ArchivioUI'
import {
  TestataAtleti, FiltriStato, FasciaRichiamo, RigaAtleta, RigaPausa,
  RigaEliminato, ScheletroAtleti, VuotoAtleti,
} from '../components/AtletiUI'

export default function Athletes() {
  const [athletes, setAthletes] = useState([])
  const [eliminati, setEliminati] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [loading, setLoading] = useState(true)
  const [caricatoIl, setCaricatoIl] = useState(() => Date.now())
  const [vista, setVista] = useState('attivi')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const navigate = useNavigate()
  const { role } = useAuth()

  useEffect(() => {
    if (role === 'athlete') {
      navigate('/')
      return
    }
    fetchAthletes()
  }, [role, navigate])

  const fetchAthletes = async () => {
    setLoading(true)
    const adesso = new Date()

    // Una sola finestra per due domande. `atletiFermi` guarda indietro fino a
    // FINESTRA_STORICO, l'aderenza guarda la settimana in corso (che finisce
    // nel futuro): due `select` sullo stesso intervallo sarebbero due round
    // trip per gli stessi dati. Niente join sui `workouts`: qui non serve
    // nemmeno un titolo, e `sections` è la colonna più pesante del database.
    const da = format(subDays(startOfDay(adesso), FINESTRA_STORICO), 'yyyy-MM-dd')
    const a = settimanaDi(adesso).a

    // ⚠️ UNA lettura di `athletes`, non due. Erano due query sulla stessa
    // tabella con due filtri complementari su `deleted_at`, cioè due round trip
    // per una lista di dodici righe che si divide in due con un `filter`. Il
    // cestino resta ordinato per data di eliminazione: quello è un ordine suo,
    // e la query principale ordina per nome.
    const [atletiRes, assRes] = await Promise.all([
      supabase.from('athletes').select('*').order('name'),
      supabase.from('athlete_workouts').select('id, athlete_id, status, completed_date')
        .gte('completed_date', da).lte('completed_date', a),
    ])

    // Nascondiamo il profilo di coaching@federicoleo.it a TUTTI gli admin
    // usando il suo ID univoco.
    const tutti = (atletiRes.data || []).filter(x => x?.id && x.id !== COACHING_ID)

    setAthletes(tutti.filter(x => x.deleted_at == null))
    // Gli atleti eliminati restano recuperabili per 7 giorni, poi il cron
    // delete_expired_athletes() li cancella DEFINITIVAMENTE — e con loro, in
    // cascata, workout assegnati, record personali e log. Il backup di quella
    // notte gira PRIMA, quindi da lì in poi non c'è più modo di recuperarli.
    setEliminati(
      tutti.filter(x => x.deleted_at != null)
        .sort((p, q) => Number(q.deleted_at) - Number(p.deleted_at))
    )
    setAssegnazioni(assRes.data || [])
    // ⚠️ L'istante si fissa QUI, quando i dati arrivano, non durante il render.
    // Date.now() chiamato nel render è impuro: due render consecutivi darebbero
    // conteggi diversi — e da qui dipendono l'età, la settimana in corso, chi è
    // fermo e il conto alla rovescia del cestino, cioè quasi tutta la pagina.
    setCaricatoIl(Date.now())
    setLoading(false)
  }

  const ripristina = async (atleta) => {
    const { error } = await supabase.from('athletes').update({ deleted_at: null }).eq('id', atleta.id)
    if (error) return mostraErrore(error.message)
    mostraSuccesso(`${nomeAtleta(atleta)} è tornato fra i tuoi atleti.`, 'Ripristinato')
    fetchAthletes()
  }

  const oggi = useMemo(() => new Date(caricatoIl), [caricatoIl])

  const attivi = useMemo(() => athletes.filter(x => !inPausa(x)), [athletes])
  const inSosta = useMemo(() => athletes.filter(x => inPausa(x)), [athletes])
  const conteggi = useMemo(() => conteggiStato(athletes, eliminati), [athletes, eliminati])

  const aderenze = useMemo(() => aderenzaSettimana(assegnazioni, { oggi }), [assegnazioni, oggi])

  // ⚠️ Gli atleti fermi arrivano da `statisticheCoach`, la stessa funzione con
  // la stessa soglia che alimenta «Richiedono attenzione» nella Home coach. Un
  // secondo calcolo qui darebbe due numeri diversi per lo stesso concetto in
  // due schermate della stessa app, e nessuno dei due sarebbe sbagliato da
  // solo — cioè il difetto impossibile da notare.
  const fermi = useMemo(
    () => atletiFermi(athletes, assegnazioni, { oggi }),
    [athletes, assegnazioni, oggi]
  )
  const idFermi = useMemo(() => new Set(fermi.map(f => f.id)), [fermi])

  const apriAtleta = useCallback((id) => navigate(`/athletes/${id}`), [navigate])

  const cambiaVista = (nuova) => { setVista(nuova); setSearch('') }

  const conRicerca = search.trim() !== ''

  const lista = useMemo(() => {
    const base = vista === 'pausa' ? inSosta
      : vista === 'eliminati' ? eliminati
      : vista === 'fermi' ? attivi.filter(x => idFermi.has(x.id))
      : attivi
    return filtraPerNome(base, search)
  }, [vista, attivi, inSosta, eliminati, idFermi, search])

  // La lista degli in pausa che accompagna la vista principale. Restano
  // visibili di proposito (CLAUDE.md §9-decies): la rubrica è l'unico posto in
  // cui il coach si accorge di averne messo in pausa uno e dimenticato.
  const sostaVisibili = useMemo(
    () => (vista === 'attivi' ? filtraPerNome(inSosta, search) : []),
    [vista, inSosta, search]
  )

  const dettaglio = loading ? null
    : conRicerca ? `${lista.length + sostaVisibili.length} ${lista.length + sostaVisibili.length === 1 ? 'atleta' : 'atleti'}`
    : conteggi.pausa > 0
      ? `${conteggi.attivi} attivi · ${conteggi.pausa} in pausa`
      : `${conteggi.attivi} ${conteggi.attivi === 1 ? 'atleta' : 'atleti'}`

  const titoloSezione = vista === 'eliminati' ? 'Eliminati di recente'
    : vista === 'pausa' ? 'In pausa'
    : vista === 'fermi' ? 'Da richiamare'
    : 'Settimana in corso'

  const dettaglioSezione = vista === 'eliminati' ? 'Giorni rimasti'
    : vista === 'pausa' ? `${lista.length}`
    : 'Completati / assegnati'

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)] page-transition">
      <TestataAtleti dettaglio={dettaglio} onNuovo={() => setModalOpen(true)}>
        <CampoRicerca valore={search} onCambia={setSearch}
          etichetta="Cerca un atleta" placeholder="Cerca nome o cognome" />
        <FiltriStato conteggi={conteggi} vista={vista} onCambia={cambiaVista} />
      </TestataAtleti>

      {loading ? <ScheletroAtleti /> : (
        <>
          {fermi.length > 0 && (vista === 'attivi' || vista === 'fermi') && (
            <FasciaRichiamo
              attiva={vista === 'fermi'}
              onApri={() => cambiaVista(vista === 'fermi' ? 'attivi' : 'fermi')}
              testo={`${fermi.length} ${fermi.length === 1 ? 'atleta fermo' : 'atleti fermi'} da ${GIORNI_FERMO} giorni o più`}
            />
          )}

          {athletes.length === 0 && eliminati.length === 0 ? (
            <VuotoAtleti titolo="Nessun atleta ancora"
              dettaglio="Gli atleti che aggiungi compaiono qui, con l'aderenza della loro settimana. 🏃"
              azione="Aggiungi il primo atleta" onAzione={() => setModalOpen(true)} />
          ) : lista.length === 0 && sostaVisibili.length === 0 ? (
            <VuotoAtleti
              titolo={conRicerca ? 'Nessun atleta con questo nome' : `Nessun atleta in «${titoloSezione}»`}
              dettaglio={conRicerca ? 'Prova con il cognome, o azzera la ricerca.' : null}
              azione={conRicerca ? 'Azzera la ricerca' : null}
              onAzione={() => setSearch('')} />
          ) : (
            <>
              {lista.length > 0 && (
                <>
                  <IntestazioneSezione etichetta={titoloSezione} conteggio={dettaglioSezione} />
                  <div className="flex flex-col gap-2">
                    {lista.map(x => vista === 'eliminati' ? (
                      <RigaEliminato key={x.id} nome={nomeAtleta(x)} foto={x.photo_url} sigla={iniziali(x)}
                        giorni={giorniRimastiCestino(x.deleted_at, caricatoIl)}
                        onRipristina={() => ripristina(x)} />
                    ) : vista === 'pausa' ? (
                      <RigaPausa key={x.id} nome={nomeAtleta(x)} dettaglio={etichettaPausa(x)}
                        foto={x.photo_url} sigla={iniziali(x)} onApri={() => apriAtleta(x.id)} />
                    ) : (
                      <RigaAtleta key={x.id} nome={nomeAtleta(x)} meta={metaAtleta(x, oggi)}
                        foto={x.photo_url} sigla={iniziali(x)}
                        aderenza={aderenze.get(x.id) || NESSUNA_ADERENZA}
                        fermo={idFermi.has(x.id)} onApri={() => apriAtleta(x.id)} />
                    ))}
                  </div>
                </>
              )}

              {sostaVisibili.length > 0 && (
                <>
                  <IntestazioneSezione etichetta="In pausa" conteggio={`${sostaVisibili.length}`} />
                  <div className="flex flex-col gap-2">
                    {sostaVisibili.map(x => (
                      <RigaPausa key={x.id} nome={nomeAtleta(x)} dettaglio={etichettaPausa(x)}
                        foto={x.photo_url} sigla={iniziali(x)} onApri={() => apriAtleta(x.id)} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {vista === 'eliminati' && lista.length > 0 && (
            <p className="mt-4 px-0.5 text-xs leading-relaxed text-muted">
              Dopo {GIORNI_CESTINO} giorni vengono cancellati definitivamente, insieme ai loro
              allenamenti e record personali. L'operazione non è reversibile.
            </p>
          )}
        </>
      )}

      {modalOpen && (
        <NewAthleteModal
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchAthletes() }}
        />
      )}
    </div>
  )
}

function NewAthleteModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', surname: '', birth_date: '', weight: '', height: '', notes: '' })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.name || !form.surname) return mostraErrore('Nome e cognome obbligatori!')
    setSaving(true)

    let photo_url = null
    if (photo) {
      const ext = photo.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('athlete-photos')
        .upload(fileName, photo, { contentType: photo.type })

      if (uploadError) {
        setSaving(false)
        mostraErrore('Errore durante il caricamento della foto: ' + uploadError.message)
        return
      }
      const { data: urlData } = supabase.storage.from('athlete-photos').getPublicUrl(fileName)
      photo_url = urlData.publicUrl
    }

    const { error } = await supabase.from('athletes').insert({
      name: form.name,
      surname: form.surname,
      birth_date: form.birth_date || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseFloat(form.height) : null,
      notes: form.notes,
      photo_url
    })

    setSaving(false)
    if (error) { mostraErrore('Errore: ' + error.message); return }
    onSaved()
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">Nuovo Atleta</p>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {/* FOTO */}
          <div className="flex justify-center">
            <label className="cursor-pointer">
              <div className="w-20 h-20 rounded-full bg-[#2a2a2a] border-2 border-dashed border-[#444] flex items-center justify-center overflow-hidden hover:border-brand transition">
                {photoPreview
                  ? <img src={photoPreview} className="w-full h-full object-cover" onError={() => setPhotoPreview(null)} />
                  : <User size={28} className="text-muted" />
                }
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>

          {/* FORM */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Nome *</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand text-base"
                placeholder="Mario" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Cognome *</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand text-base"
                placeholder="Rossi" value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs pl-1">Data di nascita</label>
            <input type="date" className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand text-base" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Peso (kg)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand text-base"
                placeholder="Es. 75" type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Altezza (cm)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand text-base"
                placeholder="Es. 180" type="number" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} />
            </div>
          </div>

          <textarea className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand resize-none text-base"
            rows={3} placeholder="Note biografiche (facoltativo)"
            value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div className="p-5 border-t border-[#2a2a2a]">
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-brand text-black font-bold py-4 rounded-xl hover:brightness-110 transition disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Salva Atleta'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}