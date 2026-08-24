import { NavLink } from 'react-router-dom'
import { Home, Calendar, Plus, Users, User } from 'lucide-react'
import { useAuth } from '../App'

export default function Navbar() {
  const { role } = useAuth()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#222222] border-t border-[#333] flex justify-around items-center z-50 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]">
      <NavLink to="/" className={({ isActive }) =>
        `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-[#f1ba17]' : 'text-gray-400'}`
      }>
        <Home size={22} />
        <span>Home</span>
      </NavLink>

      {role !== 'athlete' && (
        <NavLink to="/create" className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-[#f1ba17]' : 'text-gray-400'}`
        }>
          <Plus size={22} />
          <span>Workout</span>
        </NavLink>
      )}


      <NavLink to="/calendar" className={({ isActive }) =>
        `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-[#f1ba17]' : 'text-gray-400'}`
      }>
        <Calendar size={22} />
        <span>Calendario</span>
      </NavLink>

      {role !== 'athlete' && (
        <NavLink to="/athletes" className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-[#f1ba17]' : 'text-gray-400'}`
        }>
          <Users size={22} />
          <span>Atleti</span>
        </NavLink>
      )}

      {role === 'athlete' && (
        <NavLink to="/profile" className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-[#f1ba17]' : 'text-gray-400'}`
        }>
          <User size={22} />
          <span>Profilo</span>
        </NavLink>
      )}
    </nav>
  )
}