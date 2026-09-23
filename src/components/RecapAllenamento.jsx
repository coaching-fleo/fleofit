// Il confine pigro del recap post-allenamento (22/09/2026).
//
// 🔴 ESISTE SOLO PER NON PESARE SULL'AVVIO, e il numero è misurato: il recap
// lo montano TRE pagine (Home, scheda workout, scheda atleta), quindi Rollup
// lo raccoglie in un chunk condiviso — che in questo progetto è il chunk di
// ingresso. Importato direttamente, portava l'`index` da **593 a 626 KB**:
// 32 KB di parsing davanti a ogni apertura dell'app, per una schermata che si
// vede qualche volta a settimana e mai prima di aver chiuso un allenamento.
// È la stessa aritmetica di `jspdf` in testa alla scheda (CLAUDE.md
// §9-noviesdecies) e della libreria degli effetti in `CreaWorkoutUI`
// (§9-duetricies), su una scala più piccola.
//
// ⚠️ Il confine sta QUI e non nelle tre pagine: un `lazy()` per pagina sarebbe
// tre `Suspense` da tenere allineati, e la prima che si dimentica riporta
// tutto dentro il chunk condiviso senza dare nessun errore.
//
// ⚠️ `fallback={null}` e non una rotella: il chunk è già sul dispositivo (su
// iOS il bundle è locale) e l'attesa è di un fotogramma. Una rotella che
// lampeggia per un fotogramma sopra una schermata di festeggiamento si legge
// come un inciampo.

import { lazy, Suspense } from 'react'

const RecapDati = lazy(() => import('./RecapDati'))

export default function RecapAllenamento(props) {
  return (
    <Suspense fallback={null}>
      <RecapDati {...props} />
    </Suspense>
  )
}
