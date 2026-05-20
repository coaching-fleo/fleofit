import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Keyboard } from '@capacitor/keyboard'
import { PushNotifications } from '@capacitor/push-notifications'
import { Badge } from '@capawesome/capacitor-badge'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
import TVDashboard from './pages/TVDashboard'
import CreateWorkout from './pages/CreateWorkout'
import Athletes from './pages/Athletes'
import AthleteDetail from './pages/AthleteDetail'
import WorkoutDetail from './pages/WorkoutDetail'
import WorkoutsArchive from './pages/WorkoutsArchive'
import Settings from './pages/Settings'
import Login from './pages/Login'





export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export const ADMIN_EMAILS = ['coaching@federicoleo.it', 'alessandro.patrone@hotmail.it', 'federico_leo@hotmail.it', 'federico.leo88@gmail.com']
import { User, Upload } from 'lucide-react'

function Onboarding({ user, onComplete }) {
  const [role, setRole] = useState('athlete')
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
        alert("Errore di salvataggio nel database: " + dbError.message)
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
          <h1 className="text-4xl font-black text-white tracking-tight mb-3">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
          <h2 className="text-2xl font-bold text-white text-center">Completiamo il profilo!</h2>
          <p className="text-gray-400 text-sm mt-1 text-center">Abbiamo bisogno di qualche informazione in più per iniziare.</p>
        </div>

        <form onSubmit={handleComplete} className="flex flex-col gap-4">
          {/* OPZIONE COACH DISATTIVATA TEMPORANEAMENTE */}
          {/* <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setRole('athlete')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${role === 'athlete' ? 'bg-[#f1ba17]/10 text-[#f1ba17] border border-[#f1ba17]/50' : 'bg-[#111] text-gray-500 border border-[#333]'}`}>Sono un Atleta</button>
            <button type="button" onClick={() => setRole('coach')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${role === 'coach' ? 'bg-[#f1ba17]/10 text-[#f1ba17] border border-[#f1ba17]/50' : 'bg-[#111] text-gray-500 border border-[#333]'}`}>Sono un Coach</button>
          </div> */}

          <div className="flex flex-col items-center gap-2 mb-2 animate-in fade-in">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-[#2a2a2a] border-2 border-[#333] flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" onError={() => setPhotoPreview(null)} />
                ) : (
                  <User size={48} className="text-gray-400" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-[#f1ba17] p-1.5 rounded-full cursor-pointer hover:brightness-110 shadow-lg">
                <Upload size={14} className="text-black" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            <p className="text-gray-500 text-xs">Foto Profilo (opzionale)</p>
          </div>

          <div className="grid grid-cols-2 gap-3 animate-in fade-in">
            <input required placeholder="Nome *" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17]" />
            <input required placeholder="Cognome *" value={surname} onChange={e => setSurname(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17]" />
          </div>

          {role === 'athlete' && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="flex flex-col gap-1">
                <label className="text-gray-400 text-xs pl-1">Data di Nascita *</label>
                <input type="date" required value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17] text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Peso (kg)" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17]" />
                <input type="number" placeholder="Altezza (cm)" value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17]" />
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} className="w-full mt-4 py-3.5 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50 shadow-lg flex justify-center items-center">
            {saving ? 'Salvataggio...' : 'Inizia ad usare l\'app!'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
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
      
      if (!isAdmin) {
        const { data: athleteData } = await supabase.from('athletes').select('id').eq('id', session.user.id).maybeSingle()
        if (!athleteData) {
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
            localStorage.removeItem('fleofit_invite_code')
            await supabase.auth.signOut()
            window.location.href = '/login?error=unauthorized'
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
        const { data } = await supabase.from('athletes').select('id, name, surname').eq('id', session.user.id).maybeSingle()
        if (!data || !data.name) {
          setNeedsOnboarding(true)
          setLoading(false)
          return
        }
        setUserName(data.name)
        localStorage.setItem(`fleofit_name_${session.user.id}`, data.name)
        if (data.name !== meta.first_name) {
          supabase.auth.updateUser({ data: { first_name: data.name, last_name: data.surname } }).catch(()=>{})
        }
      }
    }
    setNeedsOnboarding(false)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-5xl font-black text-white tracking-tight mb-6 animate-pulse">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
        {userName ? (
          <>
            <h1 className="text-3xl font-bold text-white mb-2">Ciao!</h1>
            <p className="text-[#f1ba17] text-sm font-medium">Stiamo preparando la tua app...</p>
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
    <AuthContext.Provider value={{ user: session.user, role }}>
      <div className="pb-16">
        {children}
        <Navbar />
      </div>
    </AuthContext.Provider>
  )
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
            if (count !== null) {
              if (count === 0) await Badge.clear().catch(()=>{});
              else await Badge.set({ count }).catch(()=>{});
              await supabase.from('push_subscriptions').update({ badge_count: count }).eq('user_id', session.user.id).eq('auth', 'capacitor_ios');
            }
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
        } catch (err) {
          console.log("Errore impostazione plugin nativi:", err)
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
        }
      }
    };

    document.addEventListener('touchstart', handleTouchOutside);
    return () => document.removeEventListener('touchstart', handleTouchOutside);
  }, []);

  return (
    <BrowserRouter>
      <DeeplinkHandler />
      <div className="min-h-screen bg-[#0B0B0B] text-white">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/tv" element={<TVDashboard />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreateWorkout /></ProtectedRoute>} />
          <Route path="/athletes" element={<ProtectedRoute><Athletes /></ProtectedRoute>} />
          <Route path="/athletes/:id" element={<ProtectedRoute><AthleteDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><AthleteDetail /></ProtectedRoute>} />
          <Route path="/workout/:id" element={<ProtectedRoute><WorkoutDetail /></ProtectedRoute>} />
          <Route path="/archive" element={<ProtectedRoute><WorkoutsArchive /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App