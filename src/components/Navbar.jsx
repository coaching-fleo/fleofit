import { NavLink } from 'react-router-dom'
import { Calendar, Plus, Users } from 'lucide-react'

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#222222] border-t border-[#333] flex justify-around items-center h-16 z-50">
      <NavLink to="/" className={({ isActive }) =>
        `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-[#f1ba17]' : 'text-gray-400'}`
      }>
        <Calendar size={22} />
        <span>Calendario</span>
      </NavLink>

      <NavLink to="/create" className={({ isActive }) =>
        `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-[#f1ba17]' : 'text-gray-400'}`
      }>
        <Plus size={22} />
        <span>Workout</span>
      </NavLink>

      <NavLink to="/athletes" className={({ isActive }) =>
        `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-[#f1ba17]' : 'text-gray-400'}`
      }>
        <Users size={22} />
        <span>Atleti</span>
      </NavLink>
    </nav>
  )
}