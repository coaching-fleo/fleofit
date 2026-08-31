import { NavLink } from 'react-router-dom'
import { Home, Calendar, Users, User } from 'lucide-react'
import { useAuth } from '../App'
import { useTastieraAperta } from '../useTastiera'

/**
 * Il manubrio dell'artboard, non quello di lucide.
 *
 * ⚠️ `Dumbbell` di lucide è diagonale con i dischi esagonali: accanto a `Home`,
 * `Calendar` e `Users` — che sono tutte forme diritte e sottili — stona, ed è
 * l'unica icona della barra che non sta sull'orizzontale. Il disegno usa un
 * bilanciere semplice e simmetrico. È la stessa eccezione già fatta per
 * `InstagramIcon` in AthleteDetail: lucide è la convenzione, non un vincolo.
 */
const Manubrio = ({ size = 21, ...resto }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...resto}>
    <path d="M6 6v12M3 9v6M18 6v12M21 9v6M6 12h12" />
  </svg>
)

// La tab bar dell'artboard `Home Coach.dc.html`, opzione 2b.
//
// Non è una barra piena attaccata al fondo: è una CAPSULA che galleggia, con
// dieci pixel d'aria sopra e sedici sotto, il vetro più denso (blur 22 e
// saturazione 170%) e un'ombra proiettata che la stacca dalla pagina. La voce
// attiva non prende una pillola dietro icona ed etichetta: prende un CERCHIO
// dietro la sola icona, che è ciò che le dà l'aria di una tab bar iOS invece
// che di un bottone selezionato.
//
// ⚠️ L'altezza NON si scrive qui. Sta in `--altezza-navbar` (src/index.css),
// da cui dipendono il wrapper di App.jsx, il fondo di ogni pagina e l'offset
// di `BarraAzioni`. Era in sette punti scritti a mano, e finché la barra è
// stata alta 4rem hanno coinciso per caso.

/** Le classi di una voce, uguali per tutte: si scrivono una volta sola. */
const voce = ({ isActive }) =>
  `flex-1 flex flex-col items-center gap-[3px] transition-colors ${
    isActive ? 'text-brand' : 'text-[#8b8f9c]'}`

/**
 * Il cerchio dietro l'icona. È l'unico segno dello stato attivo, quindi
 * esiste sempre — anche spento — o le voci ballerebbero di 36px passando
 * dall'una all'altra.
 */
const Cerchio = ({ attiva, icona: Icona }) => (
  <span className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
    attiva ? 'bg-brand/[.16]' : ''}`}>
    <Icona size={21} aria-hidden="true" />
  </span>
)

const Etichetta = ({ attiva, children }) => (
  <span className={`text-[10.5px] ${attiva ? 'font-extrabold' : 'font-bold'}`}>{children}</span>
)

function Voce({ a, icona, children }) {
  return (
    <NavLink to={a} className={voce}>
      {({ isActive }) => (
        <>
          <Cerchio attiva={isActive} icona={icona} />
          <Etichetta attiva={isActive}>{children}</Etichetta>
        </>
      )}
    </NavLink>
  )
}

export default function Navbar() {
  const { role } = useAuth()

  // Con Keyboard.resize 'native' la webview si rimpicciolisce quando la tastiera
  // sale, e questa barra — essendo ancorata in basso — si incollerebbe sopra la
  // tastiera coprendo il campo che si sta scrivendo. Su iOS la tab bar sparisce
  // mentre si digita: facciamo lo stesso. La stessa regola vale per la barra
  // «Salva workout» del builder, da cui l'hook condiviso.
  const tastieraAperta = useTastieraAperta()

  if (tastieraAperta) return null

  return (
    // ⚠️ `pointer-events-none` sul contenitore e `auto` sulla capsula: il
    // contenitore è largo quanto lo schermo ma la barra no, e senza questo i
    // pixel ai lati della capsula intercetterebbero i tocchi diretti alla
    // pagina sotto.
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none
                    px-3 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <nav className="pointer-events-auto max-w-2xl mx-auto flex items-center justify-around gap-0.5 p-2
                      rounded-full bg-[#1e1e22]/[.88] border border-white/[.09]
                      backdrop-blur-[22px] backdrop-saturate-[1.7]
                      shadow-[0_12px_30px_-8px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.06)]">
        <Voce a="/" icona={Home}>Home</Voce>

        {/* ⚠️ Manubrio, non un più: la voce porta al builder ma nomina la
            SEZIONE, non il gesto. È l'icona dell'artboard, in 2a e in 2b. */}
        {role !== 'athlete' && <Voce a="/create" icona={Manubrio}>Workout</Voce>}

        <Voce a="/calendar" icona={Calendar}>Calendario</Voce>

        {role !== 'athlete' && <Voce a="/athletes" icona={Users}>Atleti</Voce>}

        {role === 'athlete' && <Voce a="/profile" icona={User}>Profilo</Voce>}
      </nav>
    </div>
  )
}
