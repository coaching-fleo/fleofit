import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Plus, User, ChevronRight, Search, Trash2 } from 'lucide-react'
import { differenceInYears, parseISO } from 'date-fns'
import { useAuth } from '../App'
import { COACHING_ID } from '../lib/constants'
import { mostraErrore, mostraSuccesso } from '../lib/alert'

export default function Athletes() {
  const [athletes, setAthletes] = useState([])
  const [eliminati, setEliminati] = useState([])
  const [caricatoIl, setCaricatoIl] = useState(() => Date.now())
  const [mostraEliminati, setMostraEliminati] = useState(false)
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
    const { data } = await supabase.from('athletes').select('*').is('deleted_at', null).order('name')
    
    // Nascondiamo il profilo di coaching@federicoleo.it a TUTTI gli admin usando il suo ID univoco
    setAthletes((data || []).filter(a => a.id !== COACHING_ID))

    // Gli atleti eliminati restano recuperabili per 7 giorni, poi il cron
    // delete_expired_athletes() li cancella DEFINITIVAMENTE — e con loro, in
    // cascata, workout assegnati, record personali e log. Il backup gira due ore
    // dopo, quindi da lì in poi non c'è più modo di recuperarli.
    const { data: rimossi } = await supabase.from('athletes').select('*')
      .not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    setEliminati((rimossi || []).filter(a => a.id !== COACHING_ID))
    // ⚠️ L'istante si fissa QUI, quando i dati arrivano, non durante il render.
    // Date.now() chiamato nel render è impuro: due render consecutivi darebbero
    // conteggi diversi e il React Compiler non può memoizzare il componente.
    // È anche più corretto nel merito: il conto alla rovescia è relativo al
    // momento in cui la lista è stata caricata.
    setCaricatoIl(Date.now())
  }

  const GIORNI_PRIMA_DELLA_CANCELLAZIONE = 7

  const giorniRimasti = (deletedAt) => {
    const trascorsi = (caricatoIl - Number(deletedAt)) / 86400000
    return Math.max(0, Math.ceil(GIORNI_PRIMA_DELLA_CANCELLAZIONE - trascorsi))
  }

  const ripristina = async (atleta) => {
    const { error } = await supabase.from('athletes').update({ deleted_at: null }).eq('id', atleta.id)
    if (error) return mostraErrore(error.message)
    mostraSuccesso(`${atleta.name} ${atleta.surname} è tornato fra i tuoi atleti.`, 'Ripristinato')
    fetchAthletes()
  }

  const filtered = athletes.filter(a =>
    `${a.name} ${a.surname}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Atleti</h1>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-[#f1ba17] text-black font-bold px-4 py-2 rounded-xl hover:brightness-110 transition">
          <Plus size={18} /> Nuovo
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="w-full bg-[#222] border border-[#333] rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base"
          placeholder="Cerca atleta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-[#222] flex items-center justify-center mx-auto mb-4">
            <User size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-400">Nessun atleta ancora</p>
          <button onClick={() => setModalOpen(true)} className="mt-3 text-[#f1ba17] text-sm font-medium">
            + Aggiungi il primo atleta
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(a => (
            <button key={a.id} onClick={() => navigate(`/athletes/${a.id}`)}
              className="flex items-center gap-4 bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4 hover:border-[#383838] transition text-left">
              <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center overflow-hidden shrink-0">
                {a.photo_url
                  ? <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" onError={() => setAthletes(athletes.map(ath => ath.id === a.id ? { ...ath, photo_url: null } : ath))} />
                  : <User size={22} className="text-muted" />
                }
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">{a.name} {a.surname}</p>
                <p className="text-muted text-xs mt-0.5">
                  {[a.weight && `${a.weight}kg`, a.height && `${a.height}cm`, a.birth_date && `${differenceInYears(new Date(), parseISO(a.birth_date))} anni`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          ))}
        </div>
      )}

      {eliminati.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setMostraEliminati(v => !v)}
            className="flex items-center gap-2 text-muted hover:text-white text-sm font-semibold min-h-11">
            <Trash2 size={16} />
            Eliminati di recente ({eliminati.length})
            <ChevronRight size={16} className={`transition-transform ${mostraEliminati ? 'rotate-90' : ''}`} />
          </button>

          {mostraEliminati && (
            <div className="flex flex-col gap-3 mt-3">
              <p className="text-muted text-xs leading-relaxed">
                Dopo {GIORNI_PRIMA_DELLA_CANCELLAZIONE} giorni vengono cancellati definitivamente,
                insieme ai loro allenamenti e record personali. L'operazione non è reversibile.
              </p>
              {eliminati.map(a => {
                const giorni = giorniRimasti(a.deleted_at)
                return (
                  <div key={a.id}
                    className="flex items-center gap-4 bg-[#1e1e1e] border border-[#2a2a2a] border-dashed rounded-2xl p-4">
                    <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center shrink-0 opacity-60">
                      <User size={22} className="text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 font-semibold truncate">{a.name} {a.surname}</p>
                      <p className={`text-xs mt-0.5 ${giorni <= 2 ? 'text-red-400' : 'text-muted'}`}>
                        {giorni === 0 ? 'In cancellazione stanotte' : `Cancellazione fra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`}
                      </p>
                    </div>
                    <button onClick={() => ripristina(a)}
                      className="min-h-11 px-4 rounded-xl bg-[#2a2a2a] text-white text-sm font-bold hover:bg-[#333] transition shrink-0">
                      Ripristina
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
              <div className="w-20 h-20 rounded-full bg-[#2a2a2a] border-2 border-dashed border-[#444] flex items-center justify-center overflow-hidden hover:border-[#f1ba17] transition">
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
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base"
                placeholder="Mario" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Cognome *</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base"
                placeholder="Rossi" value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs pl-1">Data di nascita</label>
            <input type="date" className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f1ba17] text-base" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Peso (kg)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base"
                placeholder="Es. 75" type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs pl-1">Altezza (cm)</label>
              <input className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] text-base"
                placeholder="Es. 180" type="number" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} />
            </div>
          </div>

          <textarea className="bg-[#2a2a2a] border border-[#383838] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] resize-none text-base"
            rows={3} placeholder="Note biografiche (facoltativo)"
            value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>

        <div className="p-5 border-t border-[#2a2a2a]">
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-[#f1ba17] text-black font-bold py-4 rounded-xl hover:brightness-110 transition disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Salva Atleta'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}