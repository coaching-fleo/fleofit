import { NavLink } from 'react-router-dom'
import { Home, Calendar, Users, User, FolderArchive, Plus } from 'lucide-react'
import { useAuth } from '../App'
import { useTastieraAperta } from '../useTastiera'

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

/**
 * ⚠️ `replace` non è un dettaglio: una tab bar NON impila.
 *
 * Con la push, la history diventa il percorso di tutta la sessione — Home,
 * Calendario, Atleti, Home, Calendario — e il tasto indietro di una pagina di
 * dettaglio la ripercorre a ritroso, portando in schermate che l'utente non ha
 * mai «aperto» ma solo attraversato. Le voci della barra sono destinazioni di
 * pari grado, non passi di un cammino: si sostituiscono, come su iOS.
 */
function Voce({ a, icona, children }) {
  return (
    // `daBarra` dice alla pagina che ci si è arrivati dalla barra, non da un
    // gesto dentro un'altra pagina: il builder lo legge per non mostrare un
    // «indietro» su una destinazione di pari grado (§9-tervicies).
    <NavLink to={a} replace state={{ daBarra: true }} className={voce}>
      {({ isActive }) => (
        <>
          <Cerchio attiva={isActive} icona={icona} />
          <Etichetta attiva={isActive}>{children}</Etichetta>
        </>
      )}
    </NavLink>
  )
}

/**
 * Il «+» al centro della barra del coach (proposta A della Home, 11/11/2026):
 * crea un workout. È l'azione che il coach fa più spesso, quindi non è una voce
 * fra le altre ma il bottone giallo pieno, col suo alone. Niente etichetta:
 * il più si legge da solo, il nome lo dice `aria-label`. Sta dentro l'altezza
 * della capsula (58px su ~69 interni): `--altezza-navbar` non cambia.
 */
function Crea() {
  return (
    <NavLink to="/create" replace state={{ daBarra: true }} aria-label="Crea workout"
      className="shrink-0 w-[58px] h-[58px] mx-1 rounded-full grid place-items-center text-black
                 bg-gradient-to-b from-[#f8c83a] to-brand transition-transform duration-200 active:scale-[.94]
                 shadow-[0_0_0_5px_rgba(241,186,23,.16),0_12px_22px_-6px_rgba(241,186,23,.55),inset_0_1px_0_rgba(255,255,255,.4)]">
      <Plus size={26} strokeWidth={2.6} aria-hidden="true" />
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
      <nav aria-label="Navigazione principale" className="pointer-events-auto max-w-2xl mx-auto flex items-center justify-around gap-0.5 p-2
                      rounded-full bg-[#1e1e22]/[.88] border border-white/[.09]
                      backdrop-blur-[22px] backdrop-saturate-[1.7]
                      shadow-[0_12px_30px_-8px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.06)]">
        <Voce a="/" icona={Home}>Home</Voce>

        {role === 'athlete' ? (<>
          <Voce a="/archive" icona={FolderArchive}>Archivio</Voce>
          <Voce a="/calendar" icona={Calendar}>Calendario</Voce>
          <Voce a="/profile" icona={User}>Profilo</Voce>
        </>) : (<>
          {/* Il coach (proposta A, 11/11/2026): due voci, il «+», due voci.
              Prima il builder era la voce «Workout» col manubrio. */}
          <Voce a="/calendar" icona={Calendar}>Calendario</Voce>
          <Crea />
          <Voce a="/athletes" icona={Users}>Atleti</Voce>
          <Voce a="/archive" icona={FolderArchive}>Archivio</Voce>
        </>)}
      </nav>
    </div>
  )
}
