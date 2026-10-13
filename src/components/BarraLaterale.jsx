import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Calendar, Users, Plus, ChartNoAxesColumn, FolderArchive, Settings, Search } from 'lucide-react'
import { useAuth } from '../App'

// La barra laterale della versione desktop (docs/piano-web-desktop.md, fase 2):
// prende il posto della capsula in basso quando `eDesktop` è vero. Si carica
// pigra da App.jsx, quindi chi apre l'app dal telefono non la scarica mai.
//
// ⚠️ La ricerca vive QUI, non solo nella Home: sul desktop ⌘K deve aprirla da
// qualunque pagina. Il foglio è lo stesso `RicercaCoach` del telefono.

const RicercaCoach = lazy(() => import('./RicercaCoach'))

const VOCI = [
  { a: '/', icona: Home, etichetta: 'Home', esatta: true },
  { a: '/calendar', icona: Calendar, etichetta: 'Calendario' },
  { a: '/athletes', icona: Users, etichetta: 'Atleti' },
  { a: '/create', icona: Plus, etichetta: 'Crea workout' },
  { a: '/report', icona: ChartNoAxesColumn, etichetta: 'Report' },
  { a: '/archive', icona: FolderArchive, etichetta: 'Archivio' },
]

const voce = ({ isActive }) =>
  `flex items-center gap-3 h-11 px-3 rounded-xl text-sm transition-colors ${
    isActive ? 'bg-[#1e1e1e] text-white font-bold' : 'text-gray-400 font-semibold hover:text-white hover:bg-white/[.04]'}`

function Voce({ a, icona: Icona, etichetta, esatta }) {
  return (
    // `replace` come nella tab bar: le voci sono destinazioni di pari grado,
    // non passi di un cammino (Navbar.jsx). `daBarra` lo legge il builder.
    <NavLink to={a} end={esatta} replace state={{ daBarra: true }} className={voce}>
      {({ isActive }) => (
        <>
          <Icona size={20} aria-hidden="true" className={isActive ? 'text-brand' : ''} />
          {etichetta}
        </>
      )}
    </NavLink>
  )
}

export default function BarraLaterale() {
  const { nome } = useAuth()
  const [ricercaAperta, setRicercaAperta] = useState(false)

  useEffect(() => {
    const suTasto = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setRicercaAperta(true)
      }
    }
    window.addEventListener('keydown', suTasto)
    return () => window.removeEventListener('keydown', suTasto)
  }, [])

  const iniziali = (nome || 'Coach').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <nav aria-label="Navigazione principale"
        className="sticky top-0 h-screen w-[232px] shrink-0 flex flex-col gap-1 px-4 pt-7 pb-6
                   bg-[#0f0f0f] border-r border-[#1c1c1c]">
        <div className="px-3 pb-6 flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-[-.03em] text-white">FLEO<span className="text-brand">FIT</span></span>
          <span className="text-[11px] font-bold uppercase tracking-[.08em] text-gray-400">Coach</span>
        </div>

        <button type="button" onClick={() => setRicercaAperta(true)}
          className="mb-3 h-11 px-3 rounded-xl bg-[#111] border border-[#2a2a2a] flex items-center gap-2.5
                     text-left text-sm text-gray-400 transition hover:border-ia/45">
          <Search size={17} className="text-ia shrink-0" aria-hidden="true" />
          <span className="flex-1">Cerca</span>
          <kbd className="text-[11px] font-bold border border-[#333] rounded-md px-1.5 py-0.5 font-sans">⌘K</kbd>
        </button>

        {VOCI.map(v => <Voce key={v.a} {...v} />)}

        <div aria-hidden="true" className="h-px bg-[#1f1f1f] mx-3 my-3" />
        <Voce a="/settings" icona={Settings} etichetta="Impostazioni" />

        <div className="mt-auto px-3 pt-4 flex items-center gap-3">
          <span aria-hidden="true"
            className="w-9 h-9 rounded-full bg-brand text-black text-[13px] font-black flex items-center justify-center">
            {iniziali}
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white truncate">{nome || 'Coach'}</span>
            <span className="text-xs text-gray-400">Coach</span>
          </span>
        </div>
      </nav>

      {ricercaAperta && (
        <Suspense fallback={null}>
          <RicercaCoach onChiudi={() => setRicercaAperta(false)} />
        </Suspense>
      )}
    </>
  )
}
