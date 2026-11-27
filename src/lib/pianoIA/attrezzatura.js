// Che attrezzatura chiede un esercizio, e se l'utente ce l'ha (spec §4
// domanda 9, §5.4). Le quattro spunte del questionario (SkiErg, Rower,
// slitta, wall ball) sono le stazioni che una palestra normale spesso non
// ha; «palestra» è tutto ciò che a casa non c'è (bilancieri, kettlebell,
// manubri, sbarre, bike, sacchi).

const PER_SPUNTA = {
  slitta: ['Sled Push', 'Sled Pull', 'Prowler Push', 'Sled Drag'],
  skierg: ['SkiErg'],
  rower: ['Rowing'],
  wallBall: ['Wall Balls'],
}

const DA_PALESTRA = /Deadlift|Clean|Snatch|Jerk|Press|Thruster|Pull-up|Pullover|Muscle-up|Rope|Pegboard|GHD|Ring|Bike|Treadmill|Runner|Tire|Atlas|Yoke|Kettlebell|Dumbbell|Sandbag|Farmers|Suitcase|Back Squat|Front Squat|Overhead Squat|Zercher|Box|Swim|to-Bar|D-Ball|Log|Axle|Cluster|Waiter|Weighted|Battle/

export function richiede(nome) {
  const n = String(nome ?? '')
  for (const [spunta, nomi] of Object.entries(PER_SPUNTA)) if (nomi.includes(n)) return [spunta]
  return DA_PALESTRA.test(n) ? ['palestra'] : []
}

export function disponibile(nome, attrezzatura) {
  const a = attrezzatura || {}
  if (a.luogo === 'hyrox') return true
  return richiede(nome).every(cosa => (cosa === 'palestra' ? a.luogo === 'palestra' : a[cosa] === true))
}
