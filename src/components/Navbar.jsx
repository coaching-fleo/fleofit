import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Calendar, Plus, Users, User } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { useAuth } from '../App'

export default function Navbar() {
  const { role } = useAuth()

  // Con Keyboard.resize 'native' la webview si rimpicciolisce quando la tastiera
  // sale, e questa barra — essendo fixed bottom-0 — si incollerebbe sopra la
  // tastiera coprendo il campo che si sta scrivendo. Su iOS la tab bar sparisce
  // mentre si digita: facciamo lo stesso.
  const [tastieraAperta, setTastieraAperta] = useState(false)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handles = []
    const registra = (evento, valore) => {
      const r = Keyboard.addListener(evento, () => setTastieraAperta(valore))
      Promise.resolve(r).then(h => h && handles.push(h)).catch(() => {})
    }
    registra('keyboardWillShow', true)
    registra('keyboardWillHide', false)
    return () => { handles.forEach(h => h.remove && h.remove()) }
  }, [])

  if (tastieraAperta) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center
                    h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]
                    bg-[#0f0f11]/70 backdrop-blur-xl border-t border-white/[.07]">
      <NavLink to="/" className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition text-[10.5px]
         ${isActive ? 'bg-brand/[.12] text-brand font-extrabold' : 'text-[#7b8090] font-bold'}`
      }>
        <Home size={21} />
        <span>Home</span>
      </NavLink>

      {role !== 'athlete' && (
        <NavLink to="/create" className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition text-[10.5px]
           ${isActive ? 'bg-brand/[.12] text-brand font-extrabold' : 'text-[#7b8090] font-bold'}`
        }>
          <Plus size={21} />
          <span>Workout</span>
        </NavLink>
      )}


      <NavLink to="/calendar" className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition text-[10.5px]
         ${isActive ? 'bg-brand/[.12] text-brand font-extrabold' : 'text-[#7b8090] font-bold'}`
      }>
        <Calendar size={21} />
        <span>Calendario</span>
      </NavLink>

      {role !== 'athlete' && (
        <NavLink to="/athletes" className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition text-[10.5px]
           ${isActive ? 'bg-brand/[.12] text-brand font-extrabold' : 'text-[#7b8090] font-bold'}`
        }>
          <Users size={21} />
          <span>Atleti</span>
        </NavLink>
      )}

      {role === 'athlete' && (
        <NavLink to="/profile" className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition text-[10.5px]
           ${isActive ? 'bg-brand/[.12] text-brand font-extrabold' : 'text-[#7b8090] font-bold'}`
        }>
          <User size={21} />
          <span>Profilo</span>
        </NavLink>
      )}
    </nav>
  )
}