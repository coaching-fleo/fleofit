import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { PushNotifications } from '@capacitor/push-notifications'
import Navbar from './components/Navbar'
import Home from './pages/Home'

// Caricate su richiesta: l'avvio non deve pagare PDF, IA, BLE, TV e Health.
const Calendar = lazy(() => import('./pages/Calendar'))
const TVDashboard = lazy(() => import('./pages/TVDashboard'))
const CreateWorkout = lazy(() => import('./pages/CreateWorkout'))
const Athletes = lazy(() => import('./pages/Athletes'))
const AthleteDetail = lazy(() => import('./pages/AthleteDetail'))
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'))
const WorkoutsArchive = lazy(() => import('./pages/WorkoutsArchive'))
const WeeklyReport = lazy(() => import('./pages/WeeklyReport'))
const AthleteReport = lazy(() => import('./pages/AthleteReport'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))





export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// Il ruolo coach dipende da questo elenco: un indirizzo che non è qui NON ottiene
// l'accesso coach, per quanti permessi abbia sul database.
// 'demo@fleofit.it' è l'account fornito ad App Review: va tenuto in elenco finché
// l'app è in revisione, altrimenti il revisore vede solo la parte atleta.
// ⚠️ La stessa lista è ri-hardcodata in supabase/functions/send-reminders/index.ts:
// se aggiungi un indirizzo qui, aggiungilo anche lì e rideploya la function.
export const ADMIN_EMAILS = ['coaching@federicoleo.it', 'alessandro.patrone@hotmail.it', 'federico_leo@hotmail.it', 'federico.leo88@gmail.com', 'demo@fleofit.it']
import { User, Upload } from 'lucide-react'
import { AlertHost } from './components/CustomModals'
import { mostraErrore } from './lib/alert'
import { rinfrescaTokenPush } from './lib/pushToken'
import { scriviJson } from './lib/offlineQueue'
import { sincronizzaBadge } from './lib/badge'

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
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(meta.avatar_url || '')

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleComplete = async (e) => {
    e.preventDefault()
    setSaving(true)
    
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
      }
    }

    await supabase.auth.updateUser({
      data: { role, first_name: name, last_name: surname, avatar_url: photoUrl }
    })

    if (role === 'athlete') {
      const { error: dbError } = await supabase.from('athletes').upsert({
        id: user.id,
        name: name || user.email.split('@')[0],
        surname: surname || '',
        birth_date: dob || null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        photo_url: photoUrl
      }, { onConflict: 'id' })

      if (dbError) {
        mostraErrore("Errore di salvataggio nel database: " + dbError.message)
        setSaving(false)
        return
      }
      localStorage.setItem(`fleofit_name_${user.id}`, name || user.email.split('@')[0])
    }
    
    setSaving(false)
    onComplete(role)
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      <div className="w-full max-w-md bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-4xl font-black text-white tracking-tight mb-3">FLEO<span className="text-brand">FIT</span></h1>
          <h2 className="text-2xl font-bold text-white text-center">Completiamo il profilo!</h2>
          <p className="text-gray-400 text-sm mt-1 text-center">Abbiamo bisogno di qualche informazione in più per iniziare.</p>
        </div>

        <form onSubmit={handleComplete} className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 mb-2 animate-in fade-in">
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
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            <p className="text-muted text-xs">Foto Profilo (opzionale)</p>
          </div>

          <div className="grid grid-cols-2 gap-3 animate-in fade-in">
            <input required placeholder="Nome *" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand" />
            <input required placeholder="Cognome *" value={surname} onChange={e => setSurname(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand" />
          </div>

          {role === 'athlete' && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="flex flex-col gap-1">
                <label className="text-gray-400 text-xs pl-1">Data di Nascita *</label>
                <input type="date" required value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Peso (kg)" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand" />
                <input type="number" placeholder="Altezza (cm)" value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand" />
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} className="w-full mt-4 py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50 shadow-lg flex justify-center items-center">
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
  const [userName, setUserName] = useState('')
  const location = useLocation()

  useEffect(() => {
    let sub;
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      await handleSession(session)

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        handleSession(s)
      })
      sub = subscription
    }
    initSession()

    return () => sub?.unsubscribe()
  }, [])

  const handleSession = async (session) => {
    setSession(session)
    if (session?.user) {
      const isAdmin = ADMIN_EMAILS.includes(session.user.email?.toLowerCase())

      // 🔴 UNA lettura sola della riga atleta, e sta in testa apposta.
      // Erano due `select` sulla STESSA riga, per due domande diverse —
      // «esiste?» e «come si chiama?» — e per giunta in FILA: la seconda
      // partiva solo quando la prima era tornata. Misurato con una latenza di
      // 100 ms per query, l'avvio spendeva ~5 giri di rete di cui 4 in serie
      // prima che la Home cominciasse a chiedere i suoi dati
      // (§9-noviesdecies). `select('id, name, surname')` risponde a entrambe.
      const { data: rigaAtleta } = await supabase.from('athletes')
        .select('id, name, surname').eq('id', session.user.id).maybeSingle()

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

      const meta = session.user.user_metadata || {}
      const name = localStorage.getItem(`fleofit_name_${session.user.id}`) || meta.first_name || meta.full_name?.split(' ')[0] || session.user.email?.split('@')[0] || ''
      setUserName(name)

      let r = meta.role

      if (isAdmin) {
        const override = localStorage.getItem('adminRoleOverride')
        if (override === 'athlete') {
          r = 'athlete'
          setRole('athlete')
        } else {
          r = 'admin'
          setRole('admin')
        }
      } else if (!r) {
        setNeedsOnboarding(true)
        setLoading(false)
        return
      } else {
        setRole(r)
      }

      if (r === 'athlete' || r === 'admin') {
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
        if (rigaAtleta.name !== meta.first_name) {
          supabase.auth.updateUser({ data: { first_name: rigaAtleta.name, last_name: rigaAtleta.surname } }).catch(()=>{})
        }
      }
    }
    setNeedsOnboarding(false)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-5xl font-black text-white tracking-tight mb-6 animate-pulse">FLEO<span className="text-brand">FIT</span></h1>
        {userName ? (
          <>
            <h1 className="text-3xl font-bold text-white mb-2">Ciao!</h1>
            <p className="text-brand text-sm font-medium">Stiamo preparando la tua app...</p>
          </>
        ) : (
          <h1 className="text-xl font-bold text-white">Caricamento...</h1>
        )}
      </div>
    )
  }

  if (!session) {
    return <Navigate to={`/login${location.search}${location.hash}`} replace />
  }

  if (needsOnboarding) {
    return <Onboarding user={session.user} onComplete={async (newRole) => {
      const isAdmin = ADMIN_EMAILS.includes(session.user.email?.toLowerCase())
      setRole(isAdmin ? 'admin' : newRole)
      setNeedsOnboarding(false)
    }} />
  }

  return (
    // ⚠️ `nome` sta qui perché la Home lo rileggeva dal database una TERZA
    // volta (`athletes.select('name')`), per un dato che questo componente ha
    // già in mano. Chi consuma il contesto deve reggere `nome` mancante: i
    // test montano le pagine da sole e non lo passano (montaPagina.jsx).
    <AuthContext.Provider value={{ user: session.user, role, nome: userName }}>
      {/* Lo spazio per la tab bar viene da --altezza-navbar (src/index.css),
          non da un `pb-16` scritto qui: la barra è alta quanto è alta, e
          questo numero deve seguirla da solo. */}
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

  useEffect(() => {
    const isNative = typeof window !== 'undefined' && !!window?.Capacitor?.isNativePlatform?.();

    if (isNative) {
      CapacitorApp.addListener('appUrlOpen', async (event) => {
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
            // 3. Forza la creazione della sessione in Supabase in modo esplicito
            const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (!error) return navigate('/', { replace: true });
          }
          
          navigate(`/login${url.search}${url.hash}`, { replace: true });
        }
      });

      // 3-bis. Tiene fresco il token push: i token cambiano da soli e senza
      // questo l'utente smetteva di ricevere le notifiche in silenzio.
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user?.id) rinfrescaTokenPush(data.session.user.id)
      }).catch(() => {})

      // 4. Ascolta il "Tap" (tocco) dell'utente su una notifica push in entrata
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const data = notification.notification.data;
        if (data && data.route) {
          navigate(data.route);
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
      });
    }
  }, [navigate]);

  return null;
}

function App() {
  useEffect(() => {
    const setupNative = async () => {
      if (typeof window !== 'undefined' && !!window?.Capacitor?.isNativePlatform?.()) {
        try {
          // Forza l'orologio bianco e rimuove la barra extra della tastiera web
          await StatusBar.setStyle({ style: Style.Dark })
          await Keyboard.setAccessoryBarVisible({ isVisible: false })
          
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
          {/* Un solo <ProtectedRoute> per tutte le pagine private: è la route
              di layout, e le pagine sono sue figlie. Non riavvolgerne nessuna. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/create" element={<CreateWorkout />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes/:id" element={<AthleteDetail />} />
            <Route path="/profile" element={<AthleteDetail />} />
            <Route path="/workout/:id" element={<WorkoutDetail />} />
            <Route path="/archive" element={<WorkoutsArchive />} />
            {/* Riservata al coach: la pagina rimanda l'atleta alla Home da sé,
                come fa /athletes. Non è una guardia di sicurezza — quella la
                fanno le policy RLS — ma di interfaccia. */}
            <Route path="/report" element={<WeeklyReport />} />
            <Route path="/report/:id" element={<AthleteReport />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

export default App