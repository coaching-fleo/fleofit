import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
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
      await supabase.from('athletes').upsert({
        id: user.id,
        name: name || user.email.split('@')[0],
        surname: surname || '',
        birth_date: dob || null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        photo_url: photoUrl
      }, { onConflict: 'id' })
    }
    
    setSaving(false)
    onComplete(role)
  }

  return (
    <div className="min-h-screen bg-[#171717] flex flex-col items-center justify-center p-4 page-transition">
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

  useEffect(() => {
    let sub;
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      await handleSession(session)

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
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
      const meta = session.user.user_metadata || {}
      const name = meta.first_name || meta.full_name?.split(' ')[0] || session.user.email?.split('@')[0] || ''
      setUserName(name)

      const isAdmin = ADMIN_EMAILS.includes(session.user.email?.toLowerCase())
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
        const { data } = await supabase.from('athletes').select('id, name').eq('id', session.user.id).single()
        if (!data || !data.name) {
          setNeedsOnboarding(true)
          setLoading(false)
          return
        }
      }

      // Piccola pausa per mostrare la schermata di caricamento col nome
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    setNeedsOnboarding(false)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#171717] flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-5xl font-black text-white tracking-tight mb-6 animate-pulse">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
        {userName ? (
          <>
            <h1 className="text-3xl font-bold text-white mb-2">Ciao, {userName}!</h1>
            <p className="text-[#f1ba17] text-sm font-medium">Stiamo preparando la tua app...</p>
          </>
        ) : (
          <h1 className="text-xl font-bold text-white">Caricamento...</h1>
        )}
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
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

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#171717] text-white">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreateWorkout /></ProtectedRoute>} />
          <Route path="/athletes" element={<ProtectedRoute><Athletes /></ProtectedRoute>} />
          <Route path="/athletes/:id" element={<ProtectedRoute><AthleteDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><AthleteDetail /></ProtectedRoute>} />
          <Route path="/workout/:id" element={<ProtectedRoute><WorkoutDetail /></ProtectedRoute>} />
          <Route path="/archive" element={<ProtectedRoute><WorkoutsArchive /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App