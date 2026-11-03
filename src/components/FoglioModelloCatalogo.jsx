import { useState, useRef } from 'react'
import { Camera } from 'lucide-react'
import { LABEL, BOTTONE_BRAND, BOTTONE_QUIETO } from '../lib/stiliCard'
import { useBottomSheet } from '../useBottomSheet'
import { Foglio } from './FoglioMessaggio'
import { Campo, Filtro } from './ScarpeUI'
import { TIPI_SCARPA } from '../lib/kmScarpe'
import { LIVELLI, OPZIONI, validaModello } from '../lib/caratteristicheScarpa'
import { riduciFoto } from '../lib/fotoScarpa'
import { vibraScelta } from '../lib/aptica'
import { mostraErrore } from '../lib/alert'

// Nuovo modello o modifica di uno del catalogo (solo staff), con tutte le
// caratteristiche della scheda. Il foglio chiama `validaModello` (la stessa
// del salvataggio): un valore fuori scala si vede subito e «Salva» resta spento.
// ⚠️ Con `parziale: true` e SOLO le chiavi del foglio: `foto_url` non c'è, quindi
// una modifica non la azzera.

const testo = (v) => (v == null ? '' : String(v).replace('.', ','))

/** Un campo a scelta singola: tocchi di nuovo la voce scelta e si svuota. */
function SceltaSingola({ etichetta, voci, valore, onCambia }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>{etichetta}</span>
      <div role="group" aria-label={etichetta} className="flex flex-wrap gap-2">
        {voci.map(v => (
          <Filtro key={v.valore} attivo={valore === v.valore} onClick={() => onCambia(valore === v.valore ? '' : v.valore)}>
            {v.etichetta}
          </Filtro>
        ))}
      </div>
    </div>
  )
}

/** Il bottone che apre la scelta di una foto (png, webp o jpeg). */
export function BottoneFoto({ onScelta, children = 'Carica foto', disabled }) {
  const input = useRef(null)
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => input.current?.click()}
        className={`${BOTTONE_QUIETO} inline-flex items-center justify-center gap-2`}>
        <Camera size={17} aria-hidden="true" />{children}
      </button>
      <input ref={input} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onScelta(f) }} />
    </>
  )
}

/**
 * `iniziale`: il modello da modificare (con `id`) o i valori di partenza.
 * `onSalva(dati)` torna true se il foglio può chiudersi.
 * `onCaricaFoto({ blob, est, trasparente })`: assente = niente «Carica foto»
 * (un modello nuovo non ha ancora un id su cui caricarla).
 */
export function FoglioModelloCatalogo({ iniziale, onSalva, onCaricaFoto, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)
  const modifica = !!iniziale?.id
  const i = iniziale || {}
  const [campi, setCampi] = useState({
    marca: i.marca ?? '', modello: i.modello ?? '', tipo: i.tipo ?? '', livello: i.livello ?? '',
    ammortizzamento: i.ammortizzamento ?? '', stabilita: i.stabilita ?? '', piastra: i.piastra ?? '',
    uso: Array.isArray(i.uso) ? i.uso : [],
    drop_mm: testo(i.drop_mm), peso_g: testo(i.peso_g), stack_mm: testo(i.stack_mm), vita_km: testo(i.vita_km),
    url_ufficiale: i.url_ufficiale ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [caricando, setCaricando] = useState(false)
  const [avvisoFoto, setAvvisoFoto] = useState(null)
  const imposta = (k) => (v) => setCampi(c => ({ ...c, [k]: v }))
  const { dati, errori } = validaModello(campi, { parziale: true })
  const puoSalvare = Object.keys(errori).length === 0 && !salvando

  const alternaUso = (v) => setCampi(c => ({ ...c, uso: c.uso.includes(v) ? c.uso.filter(x => x !== v) : [...c.uso, v] }))

  const salva = async () => {
    if (!puoSalvare) return
    setSalvando(true)
    const ok = await onSalva(dati)
    if (ok) sheet.chiudi()
    else setSalvando(false)
  }

  const scegliFoto = async (file) => {
    setCaricando(true)
    setAvvisoFoto(null)
    try {
      const ridotta = await riduciFoto(file)
      await onCaricaFoto(ridotta)
      setAvvisoFoto(ridotta.trasparente
        ? 'Foto caricata.'
        : 'Questa foto ha lo sfondo: si vedrà in un riquadro.')
    } catch (e) {
      console.warn('Foto non caricata:', e)
      mostraErrore('Non sono riuscito a caricare la foto. Controlla la connessione e riprova.')
    } finally {
      setCaricando(false)
    }
  }

  return (
    <Foglio titolo={modifica ? 'Modifica modello' : 'Nuovo modello'} {...sheet}>
      <div className="flex flex-col gap-3.5 pb-1">
        <Campo etichetta="Marca" valore={campi.marca} onChange={imposta('marca')} maxLength={60} errore={errori.marca} />
        <Campo etichetta="Modello" valore={campi.modello} onChange={imposta('modello')} maxLength={80} errore={errori.modello} />
        <SceltaSingola etichetta="Tipo" voci={TIPI_SCARPA} valore={campi.tipo} onCambia={(v) => { vibraScelta(); imposta('tipo')(v) }} />
        <SceltaSingola etichetta="Livello" voci={LIVELLI} valore={campi.livello} onCambia={imposta('livello')} />
        <SceltaSingola etichetta="Ammortizzamento" voci={OPZIONI.ammortizzamento} valore={campi.ammortizzamento} onCambia={imposta('ammortizzamento')} />
        <SceltaSingola etichetta="Stabilità" voci={OPZIONI.stabilita} valore={campi.stabilita} onCambia={imposta('stabilita')} />
        <SceltaSingola etichetta="Piastra" voci={OPZIONI.piastra} valore={campi.piastra} onCambia={imposta('piastra')} />
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Uso ideale</span>
          <div role="group" aria-label="Uso ideale" className="flex flex-wrap gap-2">
            {OPZIONI.uso.map(u => (
              <Filtro key={u.valore} attivo={campi.uso.includes(u.valore)} onClick={() => alternaUso(u.valore)}>{u.etichetta}</Filtro>
            ))}
          </div>
        </div>
        <Campo etichetta="Drop (mm)" valore={campi.drop_mm} onChange={imposta('drop_mm')} inputMode="decimal" placeholder="Facoltativo" errore={errori.drop_mm} />
        <Campo etichetta="Peso (g)" valore={campi.peso_g} onChange={imposta('peso_g')} inputMode="numeric" placeholder="Facoltativo" errore={errori.peso_g} />
        <Campo etichetta="Altezza al tallone (mm)" valore={campi.stack_mm} onChange={imposta('stack_mm')} inputMode="decimal" placeholder="Facoltativo" errore={errori.stack_mm} />
        <Campo etichetta="Vita stimata (km)" valore={campi.vita_km} onChange={imposta('vita_km')} inputMode="numeric" placeholder="Facoltativo" errore={errori.vita_km} />
        <Campo etichetta="Pagina ufficiale" valore={campi.url_ufficiale} onChange={imposta('url_ufficiale')} inputMode="url" placeholder="https://…" errore={errori.url_ufficiale} />
        {onCaricaFoto && (
          <div className="flex flex-col gap-1.5">
            <BottoneFoto onScelta={scegliFoto} disabled={caricando}>{caricando ? 'Carico…' : 'Carica foto'}</BottoneFoto>
            {avvisoFoto && <p role="status" className="text-[12.5px] font-medium text-muted">{avvisoFoto}</p>}
          </div>
        )}
        <div className="flex gap-3 mt-1">
          <button type="button" onClick={sheet.chiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={salva} disabled={!puoSalvare} className={BOTTONE_BRAND}>Salva</button>
        </div>
      </div>
    </Foglio>
  )
}
