import { useState, useEffect, useRef, createContext, useContext, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate, useNavigationType, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { PushNotifications } from '@capacitor/push-notifications'
import Navbar from './components/Navbar'
import { useSchermoLargo, eDesktop } from './useDesktop'
import { Apertura } from './components/Apertura'
import Consenso from './components/Consenso'
import { serveConsenso, datiConsenso } from './lib/consenso'
import { erroreProfilo } from './lib/profiloAtleta'
import Home from './pages/Home'

// Caricate su richiesta: l'avvio non deve pagare PDF, IA, BLE e TV.
const Calendar = lazy(() => import('./pages/Calendar'))
const TVDashboard = lazy(() => import('./pages/TVDashboard'))
const CreateWorkout = lazy(() => import('./pages/CreateWorkout'))
const Athletes = lazy(() => import('./pages/Athletes'))
const AthleteDetail = lazy(() => import('./pages/AthleteDetail'))
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'))

// 🔴 Una scheda per WORKOUT, non una per rotta. React Router riusa lo stesso
// componente quando cambia solo `:id`, quindi tornando da una copia appena
// eliminata all'originale la pagina si portava dietro tutto lo stato della
// copia — finestre aperte comprese. La chiave è il solo `id`: cambiare
// `athlete_id` nella query (l'elenco «Assegnato a», §9-tervicies) resta lo
// stesso workout e NON deve rimontare.
function SchedaWorkout() {
  const { id } = useParams()
  return <WorkoutDetail key={id} />
}
const WorkoutsArchive = lazy(() => import('./pages/WorkoutsArchive'))
const CollegaTV = lazy(() => import('./pages/CollegaTV'))
const WeeklyReport = lazy(() => import('./pages/WeeklyReport'))
const AthleteReport = lazy(() => import('./pages/AthleteReport'))
// Solo desktop coach: fuori dal desktop la pagina rimanda da sé a /report.
const Analisi = lazy(() => import('./pages/Analisi'))
const Settings = lazy(() => import('./pages/Settings'))
const Messaggi = lazy(() => import('./pages/Messaggi'))
const NuovoMessaggio = lazy(() => import('./pages/NuovoMessaggio'))
const Modelli = lazy(() => import('./pages/Modelli'))
const Scarpe = lazy(() => import('./pages/Scarpe'))
const DettaglioScarpa = lazy(() => import('./pages/DettaglioScarpa'))
const ModelloScarpa = lazy(() => import('./pages/ModelloScarpa'))
const MieiTeam = lazy(() => import('./pages/MieiTeam'))
const InvitoTeam = lazy(() => import('./pages/InvitoTeam'))
const Team = lazy(() => import('./pages/Team'))
const SchedaTeam = lazy(() => import('./pages/SchedaTeam'))
const DettaglioSfida = lazy(() => import('./pages/DettaglioSfida'))
// /team ha due facce: i team del coach (staff) o i team dell'atleta. Un admin
// che simula l'atleta ha già `role === 'athlete'` e vede la seconda.
function TeamIndice() {
  const { role } = useAuth() || {}
  return eStaff(role) ? <Team /> : <MieiTeam />
}
const Login = lazy(() => import('./pages/Login'))
const Landing = lazy(() => import('./pages/Landing'))
// La barra laterale del desktop (solo coach, solo web, finestra ≥ 1024px): pigra,
// così il chunk d'ingresso del telefono non cresce (CLAUDE.md §2).
const BarraLaterale = lazy(() => import('./components/BarraLaterale'))





export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// Il ruolo coach dipende da questo elenco: un indirizzo che non è qui NON ottiene
// l'accesso coach, per quanti permessi abbia sul database.
// 'demo@fleofit.it' è l'account fornito ad App Review: va tenuto in elenco finché
// l'app è in revisione, altrimenti il revisore vede solo la parte atleta.
// ⚠️ La stessa lista è ri-hardcodata in supabase/functions/send-reminders/index.ts:
// se aggiungi un indirizzo qui, aggiungilo anche lì e rideploya la function.
export { ADMIN_EMAILS }
import { User, Upload } from 'lucide-react'
import { AlertHost } from './components/CustomModals'
import { mostraErrore } from './lib/alert'
import { ADMIN_EMAILS, leggiRuolo, eStaff } from './lib/ruoli'
import { rinfrescaTokenPush } from './lib/pushToken'
import { scriviJson } from './lib/offlineQueue'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { ATTESA_SESSIONE_MS, senzaRete, sessioneSalvata, entro, ruoloSalvato, salvaRuolo } from './lib/avvioSenzaRete'
import { sincronizzaBadge } from './lib/badge'
import { gestisciIndietro, puoTornareIndietro } from './lib/indietroAndroid'
import { eUnLinkDiRecupero, recuperoInCorso, avviaRecupero, chiudiRecupero } from './lib/recuperoPassword'
import { leggiErroreLink, segnalaLinkFallito } from './lib/esitoLink'
import { rottaDaDeepLinkGarmin, recuperaAttivitaGarmin } from './lib/garmin'
import { eLinkDelTimer, eLinkDellaTV, rottaDaLinkTV } from './lib/linkTimer'
import { impostaRuoloFunzioni } from './lib/funzioniApp'
import SoloSeAccesa from './components/SoloSeAccesa'

// I campi del profilo. ⚠️ `min-w-0` e `appearance-none` non sono cosmetica: su
// iOS un `<input type="date">` ignora `w-full` e si allarga quanto il suo
// valore, e nella griglia a due colonne un campo senza `min-w-0` non scende
// sotto la sua larghezza naturale — sui telefoni stretti uscivano dalla card
// (segnalazione del 02/11/2026).
const CAMPO_PROFILO = 'block w-full min-w-0 h-12 appearance-none bg-[#111] border border-[#333] text-white text-base px-4 rounded-xl text-left focus:outline-none focus:border-brand'
const ETICHETTA_PROFILO = 'block text-gray-400 text-xs font-semibold pl-1 mb-1.5'

function Onboarding({ user, onComplete }) {
  // L'onboarding del ruolo coach è disattivato: qui il ruolo è sempre 'athlete'.
  // Se un giorno torna, ridiventa uno useState.
  const role = 'athlete'
  const meta = user.user_metadata || {}
  const [name, setName] = useState(meta.first_name || meta.full_name?.split(' ')[0] || '')
  const [surname, setSurname] = useState(meta.last_name || meta.full_name?.split(' ').slice(1).join(' ') || '')
  const [dob, setDob] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(meta.avatar_url || '')
  const oggi = new Date().toISOString().slice(0, 10)

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleComplete = async (e) => {
    e.preventDefault()
    const manca = erroreProfilo({ name, surname, dob, weight, height })
    if (manca) return setErrore(manca)
    setErrore(null)
    setSaving(true)

    try {
      let photoUrl = meta.avatar_url || null

      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const fileName = `${Date.now()}_${user.id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('athlete-photos')
          .upload(fileName, photoFile, { contentType: photoFile.type })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('athlete-photos').getPublicUrl(fileName)
          photoUrl = urlData.publicUrl
        } else {
          console.error('Foto profilo non caricata:', uploadError.message)
        }
      }

      const nome = name.trim()
      const cognome = surname.trim()

      // 🔴 PRIMA la riga atleta, POI i metadati. `updateUser` fa partire
      // USER_UPDATED, e `ProtectedRoute` a quel punto rilegge la riga: se non
      // c'è ancora, rimette questa schermata — è il «confermo e torna
      // indietro» del 02/11/2026. Nell'ordine opposto lo faceva quasi sempre.
      const { error: dbError } = await supabase.from('athletes').upsert({
        id: user.id,
        name: nome,
        surname: cognome,
        birth_date: dob,
        weight: weight ? parseFloat(String(weight).replace(',', '.')) : null,
        height: height ? parseFloat(String(height).replace(',', '.')) : null,
        photo_url: photoUrl
      }, { onConflict: 'id' })

      if (dbError) {
        setErrore('Non siamo riusciti a salvare il profilo: ' + dbError.message)
        return
      }
      localStorage.setItem(`fleofit_name_${user.id}`, nome)

      const { data, error: metaError } = await supabase.auth.updateUser({
        data: { role, first_name: nome, last_name: cognome, avatar_url: photoUrl }
      })
      if (metaError) {
        setErrore('Profilo salvato, ma non siamo riusciti a completare l\'accesso. Controlla la connessione e riprova.')
        return
      }

      await onComplete(data?.user ?? { ...user, user_metadata: { ...meta, role, first_name: nome, last_name: cognome } })
    } catch (err) {
      setErrore('Qualcosa non ha funzionato. Controlla la connessione e riprova.' + (err?.message ? ` (${err.message})` : ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#0B0B0B] flex flex-col items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      <div className="w-full max-w-md min-w-0 bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-4xl font-black text-white tracking-tight mb-3">FLEO<span className="text-brand">FIT</span></h1>
          <h2 className="text-2xl font-bold text-white text-center">Completiamo il profilo!</h2>
          <p className="text-gray-400 text-sm mt-1 text-center">Abbiamo bisogno di qualche informazione in più per iniziare.</p>
        </div>

        <form onSubmit={handleComplete} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-[#2a2a2a] border-2 border-[#333] flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" onError={() => setPhotoPreview(null)} />
                ) : (
                  <User size={48} className="text-gray-400" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-brand p-1.5 rounded-full cursor-pointer hover:brightness-110 shadow-lg">
                <Upload size={14} className="text-black" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} aria-label="Foto profilo" />
              </label>
            </div>
            <p className="text-muted text-xs">Foto Profilo (opzionale)</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="ob-nome" className={ETICHETTA_PROFILO}>Nome *</label>
              <input id="ob-nome" aria-label="Nome" autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} className={CAMPO_PROFILO} />
            </div>
            <div className="min-w-0">
              <label htmlFor="ob-cognome" className={ETICHETTA_PROFILO}>Cognome *</label>
              <input id="ob-cognome" aria-label="Cognome" autoComplete="family-name" value={surname} onChange={e => setSurname(e.target.value)} className={CAMPO_PROFILO} />
            </div>
          </div>

          {role === 'athlete' && (
            <>
              <div className="min-w-0">
                <label htmlFor="ob-nascita" className={ETICHETTA_PROFILO}>Data di nascita *</label>
                <input id="ob-nascita" aria-label="Data di nascita" type="date" max={oggi} min="1910-01-01" value={dob} onChange={e => setDob(e.target.value)} className={CAMPO_PROFILO} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label htmlFor="ob-peso" className={ETICHETTA_PROFILO}>Peso (kg)</label>
                  <input id="ob-peso" aria-label="Peso" type="text" inputMode="decimal" placeholder="es. 70" value={weight} onChange={e => setWeight(e.target.value)} className={CAMPO_PROFILO} />
                </div>
                <div className="min-w-0">
                  <label htmlFor="ob-altezza" className={ETICHETTA_PROFILO}>Altezza (cm)</label>
                  <input id="ob-altezza" aria-label="Altezza" type="text" inputMode="numeric" placeholder="es. 175" value={height} onChange={e => setHeight(e.target.value)} className={CAMPO_PROFILO} />
                </div>
              </div>
            </>
          )}

          {errore && (
            <p role="alert" className="rounded-xl bg-red-500/[.08] border border-red-500/30 text-red-400 text-sm font-medium px-3.5 py-2.5">
              {errore}
            </p>
          )}

          <button type="submit" disabled={saving} className="w-full mt-2 py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50 shadow-lg flex justify-center items-center">
            {saving ? 'Salvataggio...' : 'Inizia ad usare l\'app!'}
          </button>
        </form>
      </div>
    </div>
  )
}

/**
 * Cancello unico di tutte le pagine private, ed è una route di LAYOUT.
 *
 * 🔴 Fino al 31/08/2026 ogni <Route> aveva il PROPRIO <ProtectedRoute>: cambiare
 * pagina lo smontava e ne montava un altro, che ripartiva da `loading = true` e
 * rifaceva `getSession()` più una `select` su `athletes`. A ogni tocco, prima
 * della pagina, ricompariva la schermata di avvio dell'app — logo e
 * «Caricamento…» — e con essa sparivano Navbar e AuthContext, che stanno qui
 * dentro. Ora il montaggio è UNO solo: la sessione si risolve all'avvio, e da lì
 * in poi cambia soltanto ciò che sta in <Outlet />.
 *
 * ⚠️ Chi aggiunge una pagina privata la mette DENTRO questa route, senza
 * riavvolgerla: un secondo <ProtectedRoute> rimette lo splash sulla sua rotta.
 */
function ProtectedRoute() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [needsConsenso, setNeedsConsenso] = useState(false)
  const [userName, setUserName] = useState('')
  // L'apertura si smonta da sé quando ha finito l'uscita: da lì in poi non
  // deve più tornare, nemmeno se questo componente si ri-renderizza.
  const [aperturaFinita, setAperturaFinita] = useState(false)
  const location = useLocation()
  const desktop = eDesktop(useSchermoLargo(), role)
  // 🔴 Conta i giri di `handleSession`: vale solo l'ULTIMO. Gli eventi di
  // Supabase (INITIAL_SESSION, USER_UPDATED, TOKEN_REFRESHED…) ne fanno partire
  // più d'uno insieme, e uno vecchio che finisce per ultimo riscriveva lo stato
  // con dati letti prima — è così che l'onboarding tornava dopo la conferma
  // (02/11/2026).
  const giro = useRef(0)

  // `html.desktop` azzera l'altezza della tab bar (src/index.css): le pagine e
  // le barre `sticky` che la leggono si adattano da sole, senza saperlo.
  useEffect(() => {
    document.documentElement.classList.toggle('desktop', desktop)
  }, [desktop])

  // Garmin: al login e alla prima apertura del giorno si fa rimandare a Garmin
  // l'ultima settimana di attività, per quelle il cui invio si fosse perso
  // (src/lib/garmin.js, `recuperaAttivitaGarmin`). Solo l'atleta; il giorno
  // lo controlla la funzione, quindi tornare sull'app più volte non costa.
  const utente = session?.user ?? null
  useEffect(() => {
    if (role !== 'athlete' || !utente) return
    const prova = () => { recuperaAttivitaGarmin(supabase, utente) }
    prova()
    const quandoTorna = () => { if (document.visibilityState === 'visible') prova() }
    document.addEventListener('visibilitychange', quandoTorna)
    return () => document.removeEventListener('visibilitychange', quandoTorna)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- conta l'utente, non l'oggetto sessione rinnovato a ogni token
  }, [role, utente?.id, utente?.last_sign_in_at])

  useEffect(() => {
    let sub;
    const initSession = async () => {
      // 🔴 Senza rete `getSession()` può restare quasi un minuto a riprovare il
      // rinnovo del token, con l'apertura ferma davanti (04/11/2026). Chi ha
      // una sessione salvata sul dispositivo entra con quella, e la vera arriva
      // dopo (src/lib/avvioSenzaRete.js).
      const salvata = sessioneSalvata(supabase.auth)
      const richiesta = supabase.auth.getSession()
      const esito = !salvata ? { valore: await richiesta }
        : senzaRete() ? { scaduto: true }
        : await entro(richiesta, ATTESA_SESSIONE_MS)
      const session = esito.valore?.data?.session ?? null
      const reteCaduta = esito.scaduto || (!session && isAuthRetryableFetchError(esito.valore?.error))
      if (salvata && reteCaduta) {
        await handleSession(salvata, true)
        if (esito.scaduto) richiesta.then(({ data }) => { if (data?.session) handleSession(data.session) }).catch(() => {})
      } else {
        await handleSession(session)
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'PASSWORD_RECOVERY') avviaRecupero()
        handleSession(s)
      })
      sub = subscription
    }
    initSession()

    return () => sub?.unsubscribe()
  }, [])

  const handleSession = async (session, senzaConnessione = false) => {
    const mio = ++giro.current
    const superato = () => mio !== giro.current
    setSession(session)
    if (session?.user) {
      // 🔴 UNA lettura sola della riga atleta, e sta in testa apposta.
      // Erano due `select` sulla STESSA riga, per due domande diverse —
      // «esiste?» e «come si chiama?» — e per giunta in FILA: la seconda
      // partiva solo quando la prima era tornata. Misurato con una latenza di
      // 100 ms per query, l'avvio spendeva ~5 giri di rete di cui 4 in serie
      // prima che la Home cominciasse a chiedere i suoi dati
      // (§9-noviesdecies). `select('id, name, surname')` risponde a entrambe.
      // Il ruolo viene dalla tabella `staff` (riserva: ADMIN_EMAILS,
      // src/lib/ruoli.js) e parte INSIEME alla riga atleta, non prima: le due
      // letture non dipendono l'una dall'altra, e in fila sarebbero un giro di
      // rete in più prima della Home — la stessa trappola di sopra.
      const [ruoloDb, { data: rigaAtleta, error: erroreAtleta }] = await Promise.all([
        leggiRuolo(supabase, session.user.email),
        supabase.from('athletes').select('id, name, surname').eq('id', session.user.id).maybeSingle(),
      ])
      if (superato()) return

      // 🔴 Senza rete la riga atleta NON «manca»: non si è potuta leggere. Qui
      // il cancello mandava l'atleta a riscattare un codice invito, cioè lo
      // disconnetteva. Si entra col ruolo dell'ultimo accesso riuscito, e le
      // pagine mostrano le loro copie in cache (src/lib/avvioSenzaRete.js).
      // ⚠️ Chi è già entrato prima di questa versione non ha il ruolo salvato,
      // ma ha il nome (`fleofit_name_<uid>`): vuol dire che il profilo c'è.
      const nomeSalvato = localStorage.getItem(`fleofit_name_${session.user.id}`)
      const metaRuolo = session.user.user_metadata?.role
      const ricordato = ruoloSalvato(session.user.id)
        ?? (nomeSalvato ? (ruoloDb ?? metaRuolo ?? 'athlete') : null)
      if ((senzaConnessione || erroreAtleta) && ricordato) {
        const meta = session.user.user_metadata || {}
        const override = localStorage.getItem('adminRoleOverride')
        setRole(ricordato === 'admin' && override === 'athlete' ? 'athlete' : ricordato)
        setUserName(nomeSalvato || meta.first_name || session.user.email?.split('@')[0] || '')
        setNeedsConsenso(false)
        setNeedsOnboarding(false)
        setLoading(false)
        return
      }
      const isAdmin = ruoloDb !== null

      if (!isAdmin) {
        if (!rigaAtleta) {
          const urlParams = new URLSearchParams(window.location.search)
          const inviteCode = localStorage.getItem('fleofit_invite_code') || urlParams.get('inviteCode')
          let isAuthorized = false;

          if (inviteCode) {
            const { data } = await supabase.from('invitation_codes').update({
               used_by: session.user.id,
               used_at: new Date().toISOString(),
               is_active: false,
               used_by_email: session.user.email
            })
            .eq('code', inviteCode)
            .is('used_by', null)
            .select()
    
            if (data && data.length > 0) {
              isAuthorized = true;
            } else {
              const { data: checkData } = await supabase.from('invitation_codes').select('id').eq('code', inviteCode).eq('used_by', session.user.id).maybeSingle()
              if (checkData) isAuthorized = true;
            }
          }

          if (!isAuthorized) {
            const { data: usedCode } = await supabase.from('invitation_codes').select('id').eq('used_by', session.user.id).maybeSingle()
            if (usedCode) isAuthorized = true;
          }

          if (superato()) return

          if (!isAuthorized) {
            // 🔴 Non è più un vicolo cieco (04/09/2026, rework del login).
            //
            // Fin qui questo ramo faceva `signOut()` e mandava a
            // `/login?error=unauthorized`, che apriva un alert «Accesso
            // Negato: nessun account trovato o codice di invito mancante».
            // Chi ci finiva — cioè chiunque entri con Apple o Google prima di
            // avere un profilo, il caso NORMALE di un nuovo invitato — non
            // aveva nessuna via d'uscita se non chiudere l'app: il codice non
            // gli veniva mai chiesto, e l'alert non diceva né cosa fosse né
            // chi lo dà.
            //
            // Ora si esce sul passo 2 del login, che il codice lo chiede — e
            // lo chiede sapendo per chi, perché l'email e il provider passano
            // di qui. Il signOut resta: senza un profilo non si entra, e
            // questo è ancora il punto che lo decide.
            //
            // ⚠️ `scriviJson` e non `setItem` diretto: regola 0-bis di
            // CLAUDE.md §9. Se fallisce non cambia niente di essenziale — il
            // passo 2 si apre lo stesso, solo senza l'email in testa.
            localStorage.removeItem('fleofit_invite_code')
            scriviJson('fleofit_invito_atteso', {
              email: session.user.email || '',
              provider: session.user.app_metadata?.provider || '',
            })
            await supabase.auth.signOut()
            window.location.href = '/login?serve=invito'
            return;
          }
        } else {
          localStorage.removeItem('fleofit_invite_code')
        }
      }

      // Il consenso viene DOPO il codice invito (chi non ha un invito esce
      // prima, e non deve vedere una schermata che non lo riguarda) e PRIMA
      // dell'onboarding: peso e data di nascita sono già dati di salute.
      // Spec 2026-10-14-consenso-privacy-design.md.
      if (serveConsenso(session.user, isAdmin)) {
        setNeedsConsenso(true)
        setLoading(false)
        return
      }
      setNeedsConsenso(false)

      const meta = session.user.user_metadata || {}
      const name = localStorage.getItem(`fleofit_name_${session.user.id}`) || meta.first_name || meta.full_name?.split(' ')[0] || session.user.email?.split('@')[0] || ''
      setUserName(name)

      let r = meta.role

      if (isAdmin) {
        const override = localStorage.getItem('adminRoleOverride')
        if (override === 'athlete' && ruoloDb === 'admin') {
          r = 'athlete'
          setRole('athlete')
        } else {
          r = ruoloDb
          setRole(ruoloDb)
        }
      } else if (!r) {
        setNeedsOnboarding(true)
        setLoading(false)
        return
      } else {
        setRole(r)
      }

      if (r === 'athlete' || eStaff(r)) {
        // ⚠️ Nessuna seconda lettura: è la riga presa in testa. Resta `null`
        // anche dopo il riscatto di un codice invito — la riga `athletes` in
        // quel momento non esiste ancora — ed è ciò che manda all'onboarding,
        // esattamente come prima.
        if (!rigaAtleta || !rigaAtleta.name) {
          setNeedsOnboarding(true)
          setLoading(false)
          return
        }
        setUserName(rigaAtleta.name)
        localStorage.setItem(`fleofit_name_${session.user.id}`, rigaAtleta.name)
        // Solo dopo un accesso completo con la rete: è ciò che l'avvio senza
        // rete userà la prossima volta.
        salvaRuolo(session.user.id, isAdmin ? ruoloDb : r)
        if (rigaAtleta.name !== meta.first_name) {
          supabase.auth.updateUser({ data: { first_name: rigaAtleta.name, last_name: rigaAtleta.surname } }).catch(()=>{})
        }
      }
    }
    setNeedsOnboarding(false)
    setLoading(false)
  }

  // 🔴 L'APERTURA NON SOSTITUISCE L'APP, LE STA SOPRA — ed è tutta la
  // differenza. Qui c'era un `if (loading) return <schermata>`: con quella
  // forma, nell'istante in cui i dati arrivano la schermata SMONTA e la Home
  // MONTA nello stesso fotogramma, che è esattamente il «sparisce e basta»
  // segnalato dal committente il 22/09/2026. Una sovrapposizione invece resta
  // viva attraverso quel passaggio, e la sua uscita scopre una Home già
  // montata e già in cascata.
  //
  // ⚠️ E DEVE RESTARE LO STESSO ELEMENTO attraverso i rami di questo
  // componente: renderizzarla in due punti diversi la farebbe smontare e
  // rimontare al cambio di ramo, e l'entrata ripartirebbe a metà uscita.
  const apertura = !aperturaFinita && (
    <Apertura pronto={!loading} onFine={() => setAperturaFinita(true)} />
  )

  // 🔴 Una sessione nata dal link «reimposta password» non apre l'app: prima
  // si sceglie la password nuova (src/lib/recuperoPassword.js).
  if (recuperoInCorso()) return <Navigate to="/login" replace />

  if (loading) return apertura

  if (!session) {
    // ⚠️ Niente apertura qui: si sta uscendo verso il login, e un velo che si
    // dissolve sopra un redirect è un velo che nessuno vede.
    return <Navigate to={`/login${location.search}${location.hash}`} replace />
  }

  if (needsConsenso) {
    return <>{apertura}<Consenso
      onAccetta={async () => {
        const consenso = datiConsenso()
        const { data, error } = await supabase.auth.updateUser({ data: { consenso } })
        if (error) {
          mostraErrore('Non siamo riusciti a salvare il consenso. Controlla la connessione e riprova.')
          return
        }
        // Si riparte dalla sessione con i metadati nuovi: il resto del
        // cancello (ruolo, onboarding) va avanti da dove si era fermato.
        const user = data?.user
          ?? { ...session.user, user_metadata: { ...session.user.user_metadata, consenso } }
        await handleSession({ ...session, user })
      }}
      onRifiuta={async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
      }} /></>
  }

  if (needsOnboarding) {
    // Finito il profilo si rifà il cancello da capo con l'utente aggiornato,
    // come dopo il consenso: è il giro più recente, quindi vince su quelli
    // partiti prima che la riga atleta esistesse.
    return <>{apertura}<Onboarding user={session.user} onComplete={(user) => handleSession({ ...session, user })} /></>
  }

  // Gli interruttori delle funzioni (funzioni_app) chiedono il ruolo anche da
  // fuori React (scarpeDb.js): si fissa qui, PRIMA che i figli lo leggano nei
  // loro effetti (che partono prima di quelli di questo componente).
  impostaRuoloFunzioni(role)

  return (
    // ⚠️ `nome` sta qui perché la Home lo rileggeva dal database una TERZA
    // volta (`athletes.select('name')`), per un dato che questo componente ha
    // già in mano. Chi consuma il contesto deve reggere `nome` mancante: i
    // test montano le pagine da sole e non lo passano (montaPagina.jsx).
    <AuthContext.Provider value={{ user: session.user, role, nome: userName }}>
      {apertura}
      {/* Lo spazio per la tab bar viene da --altezza-navbar (src/index.css),
          non da un `pb-16` scritto qui: la barra è alta quanto è alta, e
          questo numero deve seguirla da solo. */}
      {desktop ? (
        // Il desktop: barra laterale a sinistra, la pagina a destra. Niente
        // tab bar. Le pagine non ancora ridisegnate restano la loro colonna
        // centrata, dentro l'area a destra.
        <div className="flex min-h-screen">
          <Suspense fallback={<div className="w-[232px] shrink-0 bg-[#0f0f0f]" />}>
            <BarraLaterale />
          </Suspense>
          <main className="flex-1 min-w-0">
            <Suspense fallback={<div className="min-h-[60vh]" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      ) : (
      <div className="pb-[var(--altezza-navbar)]">
        {/* ⚠️ Il Suspense sta ANCHE qui, non solo intorno a <Routes>: a
            sospendere è il confine più vicino, e con il solo confine esterno
            finivano sotto il fallback pure questo componente e la Navbar — la
            tab bar spariva a ogni pagina caricata su richiesta. Così il chunk
            sospende soltanto <Outlet />. */}
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <Outlet />
        </Suspense>
        <Navbar />
      </div>
      )}
    </AuthContext.Provider>
  )
}

/**
 * Ogni pagina nuova si apre dall'inizio.
 *
 * 🔴 Non c'era, e non è un difetto delle ultime pagine: mancava da sempre in
 * tutta l'app. `BrowserRouter` non tocca lo scorrimento, e le pagine sono
 * figlie di una route di LAYOUT — cioè cambia solo ciò che sta dentro
 * `<Outlet />`, mentre la finestra resta esattamente dov'era. Si nota quando la
 * pagina di partenza è lunga: si scorre la Home fino in fondo, si tocca «Report
 * settimanale», e il report si apre a metà. A schermo non sembra una pagina
 * nuova aperta male — sembra che il tocco non abbia funzionato.
 *
 * ⚠️ **Solo sulle navigazioni nuove (`PUSH`/`REPLACE`), mai su `POP`.** Il
 * ritorno indietro deve riportare la pagina dov'era: chi scorre la Home fino
 * agli allenamenti scaduti, ne apre uno e torna, deve ritrovarsi lì e non in
 * cima. Azzerare anche lì trasforma un difetto in un altro, e più fastidioso —
 * perché è il gesto che si ripete di più.
 *
 * ⚠️ La dipendenza è `key` e non `pathname`: due navigazioni allo stesso
 * percorso con query diverse — `/workout/1?athlete_id=a` e `?athlete_id=b`, che
 * è il formato dei deep link (§8) — sono due pagine diverse, e il pathname non
 * cambia. `key` cambia a ogni navigazione, quale che sia.
 * ⚠️ Quel caso specifico NON è coperto dai test: nell'app non esistono due
 * comandi che portino allo stesso percorso con query diverse senza passare da
 * una pagina in mezzo, quindi non c'è modo di provocarlo montando `App`. Il
 * test sul doppio tocco della voce già attiva copre il caso «stesso percorso»
 * ma passerebbe anche con `pathname`, perché lì cambia il TIPO di navigazione
 * (`PUSH` → `REPLACE`). Chi semplifica questa dipendenza non romperà nessun
 * test.
 *
 * ⚠️ Con `startTransition` (che `BrowserRouter` applica a ogni cambio di rotta)
 * l'effetto scatta al COMMIT della pagina nuova, non al tocco: la pagina
 * precedente resta ferma dov'è finché il chunk arriva, e non fa un salto in
 * cima prima di sparire (§9-noviesdecies).
 */
function ScrollInCima() {
  const { key } = useLocation()
  const tipo = useNavigationType()

  useEffect(() => {
    if (tipo === 'POP') return
    window.scrollTo(0, 0)
  }, [key, tipo])

  return null
}

function DeeplinkHandler() {
  const navigate = useNavigate();
  // 🔴 GLI ASCOLTATORI SI REGISTRANO UNA VOLTA SOLA (02/10/2026).
  // L'effetto dipendeva da `navigate`, che con BrowserRouter cambia identità a
  // OGNI cambio di pagina, e non aveva cleanup: ogni navigazione aggiungeva un
  // altro ascoltatore. Scoperto su Android, dove un tasto indietro tornava di
  // DUE pagine; ma valeva anche su iOS per il tocco su una notifica e per il
  // deep link, gestiti tante volte quante pagine si erano aperte, e per il
  // rinfresco del token push, rifatto a ogni navigazione. Ora `navigate` passa
  // da un ref e l'effetto ha un cleanup che li toglie.
  const vaiA = useRef(navigate);
  useEffect(() => { vaiA.current = navigate }, [navigate]);
  // Dov'è l'app adesso, per il link della TV (stesso motivo: listener unico).
  const posizione = useLocation();
  const posizioneRef = useRef(posizione);
  useEffect(() => { posizioneRef.current = posizione }, [posizione]);

  useEffect(() => {
    const isNative = typeof window !== 'undefined' && !!window?.Capacitor?.isNativePlatform?.();
    const ascolti = [];

    if (isNative) {
      ascolti.push(CapacitorApp.addListener('appUrlOpen', async (event) => {
        // 🔴 Il tocco sulla Live Activity del timer: l'app deve solo tornare
        // davanti, dov'era. Senza questo il ramo sotto lo prendeva per un login
        // fallito e mandava a /login, chiudendo il timer (src/lib/linkTimer.js).
        if (eLinkDelTimer(event.url)) return;
        // 🔴 Il QR della TV letto con la fotocamera di sistema
        // (fleofit://tv/<codice>): mai /login. Con un codice valido si apre
        // /collega-tv/<codice> (pagina che sceglie il workout da mandare in TV);
        // senza, l'app torna davanti e basta. Da una scheda si resta sulla
        // scheda (`?tv=…&chiedi=1`) con `replace`: SchedaWorkout ha per chiave
        // il solo id, quindi niente rimontaggio e il timer in corso resta.
        if (eLinkDellaTV(event.url)) {
          const rottaTV = rottaDaLinkTV(event.url, posizioneRef.current);
          if (rottaTV) {
            const stessaPagina = rottaTV.split('?')[0] === posizioneRef.current.pathname;
            vaiA.current(rottaTV, stessaPagina ? { replace: true } : undefined);
          }
          return;
        }

        // 🔴 Il ritorno da Garmin PRIMA di tutto il resto: senza token
        // nell'hash il ramo sotto lo manderebbe a /login con un errore
        // (src/lib/garmin.js, rottaDaDeepLinkGarmin).
        const rotta = rottaDaDeepLinkGarmin(event.url);
        if (rotta) {
          Browser.close().catch(() => {});
          return vaiA.current(rotta, { replace: true });
        }

        const url = new URL(event.url);
        if (url.protocol === 'fleofit:') {
          Browser.close().catch(() => {});
          
          // 1. Estrae eventuale codice invito dalla URL per non perderlo
          const inviteCode = url.searchParams.get('inviteCode');
          if (inviteCode) localStorage.setItem('fleofit_invite_code', inviteCode);

          // 2. Estrae i token di accesso direttamente dall'hash
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            // 🔴 Il link «reimposta password» porta gli stessi token di un
            // login: senza questo controllo apriva la Home e la password
            // nuova non veniva mai chiesta (src/lib/recuperoPassword.js).
            // Si segna PRIMA di aprire la sessione, perché il login che
            // ascolta `onAuthStateChange` non scappi verso la Home.
            const recupero = eUnLinkDiRecupero(url.hash);
            if (recupero) avviaRecupero();

            // 3. Forza la creazione della sessione in Supabase in modo esplicito
            const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (!error) return vaiA.current(recupero ? '/login' : '/', { replace: true });
            if (recupero) chiudiRecupero();
          }

          // 🔴 Il link è tornato SENZA una sessione: prima il login si apriva
          // muto e l'utente restava fermo sulla schermata di prima
          // (src/lib/esitoLink.js). Ora il login lo dice, con cosa fare.
          segnalaLinkFallito(leggiErroreLink(url.search, url.hash));
          vaiA.current(`/login${url.search}${url.hash}`, { replace: true });
        }
      }));

      // 3-bis. Tiene fresco il token push: i token cambiano da soli e senza
      // questo l'utente smetteva di ricevere le notifiche in silenzio.
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user?.id) rinfrescaTokenPush(data.session.user.id)
      }).catch(() => {})

      // 3-ter. Il tasto indietro di Android: chiude prima la modale aperta, e
      // solo senza modali torna alla pagina precedente (src/lib/indietroAndroid.js).
      if (Capacitor.getPlatform() === 'android') {
        ascolti.push(CapacitorApp.addListener('backButton', () => {
          gestisciIndietro({
            puoTornare: puoTornareIndietro(),
            torna: () => window.history.back(),
            // Dalla prima pagina l'app va in secondo piano invece di chiudersi,
            // come fa Android 12+ con le app di sistema: riaprendola non si
            // rifà tutta l'apertura.
            esci: () => CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp()),
          })
        }));
      }

      // 4. Ascolta il "Tap" (tocco) dell'utente su una notifica push in entrata
      ascolti.push(PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const data = notification.notification.data;
        if (data && data.route) {
          vaiA.current(data.route);
        }
        const markAsRead = async () => {
          try {
            await PushNotifications.removeAllDeliveredNotifications().catch(() => {});
                const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            
            if (data && data.notif_id) {
              await supabase.from('notifications').update({ is_read: true }).eq('id', data.notif_id);
              } else if (data && data.route) {
              await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('route', data.route);
                          }

              const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('is_read', false);
            if (count !== null) await sincronizzaBadge(count, session.user.id, supabase);
          } catch (e) { console.error(e); }
        };
        markAsRead();
      }));
    }
    // ⚠️ `addListener` torna una PROMESSA di handle: si toglie quando arriva.
    return () => ascolti.forEach(p => p.then(h => h.remove()).catch(() => {}));
  }, []);

  return null;
}

function App() {
  useEffect(() => {
    const setupNative = async () => {
      if (typeof window !== 'undefined' && !!window?.Capacitor?.isNativePlatform?.()) {
        try {
          // Forza l'orologio bianco e rimuove la barra extra della tastiera web
          await StatusBar.setStyle({ style: Style.Dark })
          // ⚠️ La barra accessoria esiste solo su iOS: su Android la chiamata
          // RIFIUTA, e senza il catch il `try` saltava tutto ciò che segue —
          // compreso l'ascolto di appStateChange che pulisce le notifiche.
          await Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {})
          
             PushNotifications.removeAllDeliveredNotifications().catch(() => {});


          CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
              PushNotifications.removeAllDeliveredNotifications().catch(() => {});
            }
          });
        } catch {
          // I plugin nativi non sono critici: se non si inizializzano, l'app prosegue.
        }
      }
    }
    setupNative()
  }, [])

  // Chiude la tastiera quando si tocca fuori dai campi di testo
  useEffect(() => {
    const handleTouchOutside = (e) => {
      if (Capacitor.isNativePlatform()) {
        const target = e.target;
        // Controlla se l'elemento toccato è un input, una textarea o un elemento contenteditable
        if (
          target.tagName.toLowerCase() !== 'input' &&
          target.tagName.toLowerCase() !== 'textarea' &&
          target.getAttribute('contenteditable') !== 'true'
        ) {
          Keyboard.hide().catch(() => {});
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }
        }
      }
    };

    document.addEventListener('touchstart', handleTouchOutside);
    return () => document.removeEventListener('touchstart', handleTouchOutside);
  }, []);

  return (
    <BrowserRouter>
      <style>{`
        body {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        input, textarea, [contenteditable="true"] {
          -webkit-user-select: auto;
          user-select: auto;
          -webkit-touch-callout: default;
        }
      `}</style>
      <DeeplinkHandler />
      <ScrollInCima />
      <div className="min-h-screen bg-[#0B0B0B] text-white">
        <AlertHost />
        <Suspense fallback={<div className="min-h-screen bg-[#0B0B0B]" />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/tv" element={<TVDashboard />} />
          {/* Landing pubblica, solo web: nessuno ci arriva dall'app nativa. */}
          <Route path="/benvenuto" element={<Landing />} />
          {/* Un solo <ProtectedRoute> per tutte le pagine private: è la route
              di layout, e le pagine sono sue figlie. Non riavvolgerne nessuna. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/create" element={<CreateWorkout />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes/:id" element={<AthleteDetail />} />
            <Route path="/profile" element={<AthleteDetail />} />
            <Route path="/workout/:id" element={<SchedaWorkout />} />
            <Route path="/archive" element={<WorkoutsArchive />} />
            <Route path="/collega-tv/:codice" element={<CollegaTV />} />
            {/* Riservata al coach: la pagina rimanda l'atleta alla Home da sé,
                come fa /athletes. Non è una guardia di sicurezza — quella la
                fanno le policy RLS — ma di interfaccia. */}
            <Route path="/report" element={<WeeklyReport />} />
            <Route path="/report/:id" element={<AthleteReport />} />
            <Route path="/analisi" element={<Analisi />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/messaggi" element={<Messaggi />} />
            <Route path="/messaggi/nuovo" element={<NuovoMessaggio />} />
            {/* Solo staff: la pagina rimanda l'atleta alla Home da sé, come /analisi. */}
            <Route path="/modelli" element={<Modelli />} />
            {/* Le Scarpe hanno l'interruttore (funzioni_app): spente, il link porta alla Home. */}
            <Route path="/scarpe" element={<SoloSeAccesa nome="scarpe"><Scarpe /></SoloSeAccesa>} />
            <Route path="/scarpe/modello/:id" element={<SoloSeAccesa nome="scarpe"><ModelloScarpa /></SoloSeAccesa>} />
            <Route path="/scarpe/:id" element={<SoloSeAccesa nome="scarpe"><DettaglioScarpa /></SoloSeAccesa>} />
            {/* Il Team ha l'interruttore (funzioni_app): spento, il link porta alla Home. */}
            <Route path="/team" element={<SoloSeAccesa nome="team"><TeamIndice /></SoloSeAccesa>} />
            <Route path="/team/invito/:id" element={<SoloSeAccesa nome="team"><InvitoTeam /></SoloSeAccesa>} />
            <Route path="/team/:id" element={<SoloSeAccesa nome="team"><SchedaTeam /></SoloSeAccesa>} />
            <Route path="/team/:id/sfida/:sfidaId" element={<SoloSeAccesa nome="team"><DettaglioSfida /></SoloSeAccesa>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

export default App