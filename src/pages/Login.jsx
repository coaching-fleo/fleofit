import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Mail, Lock, LogIn, ChevronLeft } from 'lucide-react'
import { CustomAlert } from '../components/CustomModals'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isResetPassword, setIsResetPassword] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [role, setRole] = useState('athlete')
  const [alertInfo, setAlertInfo] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Se l'utente è già loggato, lo rimandiamo subito alla Home
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/')
    })
  }, [navigate])

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      if (isResetPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/settings',
        })
        if (error) throw error
        setAlertInfo({ title: 'Email inviata', message: 'Se l\'indirizzo è corretto, riceverai un link per reimpostare la password.', type: 'success' })
        setIsResetPassword(false)
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
            emailRedirectTo: window.location.href
          }
        })
        if (error) throw error
        setAlertInfo({ title: 'Controlla la mail', message: 'Ti abbiamo inviato un link per confermare la registrazione.', type: 'success' })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
      }
    } catch (error) {
      setAlertInfo({ title: 'Errore di autenticazione', message: error.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href
        }
      })
      if (error) throw error
    } catch (error) {
      setAlertInfo({ title: 'Errore Google OAuth', message: error.message, type: 'error' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 page-transition relative overflow-hidden">
      
      {/* SCHERMATA WELCOME */}
      <div 
        className={`absolute inset-0 flex flex-col items-center justify-between p-6 ${showForm ? 'pointer-events-none' : ''}`}
        style={{
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: showForm ? 'translateY(-50px)' : 'translateY(0)',
          opacity: showForm ? 0 : 1
        }}
      >
        <div className="flex-1 flex flex-col items-center justify-center">
          <img src="/favicon.svg" alt="Logo" className="h-32 object-contain mb-4 animate-in zoom-in duration-500" />
          <h1 className="text-5xl font-black text-white tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
        </div>
        
        <div className="w-full max-w-md flex gap-4 pb-8 animate-in fade-in slide-in-from-bottom-8 duration-500 delay-300">
          <button onClick={() => { setIsSignUp(false); setShowForm(true); }} className="flex-1 py-4 bg-[#2a2a2a] text-white border border-[#383838] font-bold text-lg rounded-2xl hover:bg-[#333] transition">
            Accedi
          </button>
          <button onClick={() => { setIsSignUp(true); setShowForm(true); }} className="flex-1 py-4 bg-[#f1ba17] text-black font-bold text-lg rounded-2xl hover:brightness-110 transition shadow-lg shadow-[#f1ba17]/20">
            Registrati
          </button>
        </div>
      </div>

      {/* SCHERMATA FORM (LOGIN/REGISTRAZIONE) */}
      <div 
        className={`w-full max-w-md bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-6 shadow-2xl relative ${!showForm ? 'pointer-events-none' : ''}`}
        style={{
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: showForm ? 'translateY(0) scale(1)' : 'translateY(50px) scale(0.95)',
          opacity: showForm ? 1 : 0
        }}
      >
        
        {/* TASTO INDIETRO (Ben visibile) */}
        <button type="button" onClick={() => {
          if (isResetPassword) setIsResetPassword(false)
          else setShowForm(false)
        }} className="absolute top-5 left-5 w-10 h-10 bg-[#2a2a2a] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white transition shadow-md z-10" aria-label="Torna indietro">
          <ChevronLeft size={22} className="-ml-0.5" />
        </button>
        
        <div className="flex flex-col items-center justify-center mb-8 mt-4">
          <img src="/favicon.svg" alt="Logo" className="h-16 object-contain mb-3" />
          <h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
          <p className="text-gray-400 text-sm mt-1">{isResetPassword ? 'Recupera la tua password' : (isSignUp ? 'Crea il tuo account' : 'Accedi alla tua dashboard')}</p>
        </div>

          {/* OPZIONE COACH DISATTIVATA TEMPORANEAMENTE */}
          {/* isSignUp && (
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setRole('athlete')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${role === 'athlete' ? 'bg-[#f1ba17]/10 text-[#f1ba17] border border-[#f1ba17]/50' : 'bg-[#111] text-gray-500 border border-[#333]'}`}
              >
                Sono un Atleta
              </button>
              <button
                type="button"
                onClick={() => setRole('coach')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${role === 'coach' ? 'bg-[#f1ba17]/10 text-[#f1ba17] border border-[#f1ba17]/50' : 'bg-[#111] text-gray-500 border border-[#333]'}`}
              >
                Sono un Coach
              </button>
            </div>
          ) */}

          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-3.5 text-gray-500" />
              <input 
                type="email" 
                required
                placeholder="La tua email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 pl-11 rounded-xl focus:outline-none focus:border-[#f1ba17] transition"
              />
            </div>

            {!isResetPassword && (
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-3.5 text-gray-500" />
                <input 
                  type="password" 
                  required
                  placeholder="La tua password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 pl-11 rounded-xl focus:outline-none focus:border-[#f1ba17] transition"
                />
              </div>
            )}

            {!isResetPassword && !isSignUp && (
              <div className="flex justify-end -mt-2">
                <button type="button" onClick={() => setIsResetPassword(true)} className="text-xs text-[#f1ba17] hover:underline">
                  Password dimenticata?
                </button>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full mt-2 py-3.5 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? 'Attendere...' : (isResetPassword ? 'Invia link' : (isSignUp ? 'Registrati' : 'Accedi'))}
              {!loading && !isResetPassword && <LogIn size={18} />}
            </button>
          </form>

          {!isResetPassword && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-[#333]"></div>
                <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Oppure</span>
                <div className="flex-1 h-px bg-[#333]"></div>
              </div>

              <button type="button" onClick={handleGoogleLogin} className="w-full py-3.5 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition flex items-center justify-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continua con Google
              </button>

              <p className="mt-8 text-center text-sm text-gray-500">
                {isSignUp ? 'Hai già un account?' : 'Non hai un account?'} <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-[#f1ba17] font-semibold hover:underline">{isSignUp ? 'Accedi' : 'Registrati'}</button>
              </p>
            </>
          )}
        </div>
      {createPortal(
        <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />,
        document.body
      )}
    </div>
  )
}