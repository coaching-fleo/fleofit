import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users, Dumbbell, Plus, FolderArchive, Settings } from 'lucide-react'
import { supabase } from '../supabaseClient'


export default function Home() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ workouts: 0, athletes: 0 })

  useEffect(() => {
    async function fetchStats() {
      // Eseguiamo solo il conteggio dal DB (molto più veloce che scaricare tutti i dati)
      const { count: wCount } = await supabase.from('workouts').select('*', { count: 'exact', head: true })
      const { count: aCount } = await supabase.from('athletes').select('*', { count: 'exact', head: true })
      
      setStats({ workouts: wCount || 0, athletes: aCount || 0 })
    }
    fetchStats()
  }, [])

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-8 mt-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <img src="/favicon.svg" alt="Logo" className="h-10 object-contain" />
            <h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
          </div>
          <p className="text-gray-400 mt-1">Dashboard Coach Federico Leo</p>
        </div>
        <button onClick={() => navigate('/settings')} className="w-11 h-11 rounded-full bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
          <Settings size={22} />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div onClick={() => navigate('/calendar')} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 cursor-pointer hover:border-[#f1ba17] transition flex flex-col gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 shrink-0">
            <CalendarDays size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Calendario</h3>
            <p className="text-gray-500 text-xs mt-1">{stats.workouts} workout creati</p>
          </div>
        </div>

        <div onClick={() => navigate('/athletes')} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 cursor-pointer hover:border-[#f1ba17] transition flex flex-col gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 shrink-0">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Atleti</h3>
            <p className="text-gray-500 text-xs mt-1">{stats.athletes} atleti totali</p>
          </div>
        </div>
      </div>

      {/* Main CTA */}
      <div onClick={() => navigate('/create')} className="bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border border-[#f1ba17]/50 rounded-3xl p-6 cursor-pointer hover:border-[#f1ba17] transition relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition">
          <Dumbbell size={64} className="text-[#f1ba17] -rotate-12" />
        </div>
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-full bg-[#f1ba17] flex items-center justify-center text-black mb-4 shadow-lg shadow-[#f1ba17]/20 shrink-0">
            <Plus size={24} />
          </div>
          <h2 className="text-white font-bold text-xl mb-1">Crea Workout</h2>
          <p className="text-gray-400 text-sm w-3/4">Componi un nuovo allenamento Hyrox e assegnalo ai tuoi atleti.</p>
        </div>
      </div>

      <button 
        onClick={() => navigate('/archive')}
        className="w-full flex items-center justify-center gap-2 bg-[#2a2a2a] border border-[#383838] text-white font-semibold py-4 rounded-2xl hover:border-[#f1ba17] hover:text-[#f1ba17] transition mt-4"
      >
        <FolderArchive size={20} />
        Archivio Storico
      </button>
    </div>
  )
}