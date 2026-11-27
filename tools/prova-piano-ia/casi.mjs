// 30 utenti INVENTATI per il banco di prova (mai dati veri).
// La data di riferimento è fissa, così le settimane alla gara non cambiano
// a seconda del giorno in cui si lancia la prova.

export const OGGI = new Date('2026-11-27T12:00:00Z')

// Gare a 12, 14, 10, 5, 20 settimane da OGGI, e una già passata.
const G12 = { data: '2027-02-19', nome: 'gara inventata' }
const G14 = { data: '2027-03-05', nome: 'gara inventata' }
const G10 = { data: '2027-02-05', nome: 'gara inventata' }
const G5 = { data: '2027-01-01', nome: 'gara inventata' }
const G20 = { data: '2027-04-16', nome: 'gara inventata' }
const PASSATA = { data: '2026-11-01', nome: 'gara inventata' }

const no = { petto: false, svenimenti: false, cuore: false, gravidanza: false, intervento: false }
const hyrox = { luogo: 'hyrox', skierg: true, rower: true, slitta: true, wallBall: true }
const casa = { luogo: 'casa', skierg: false, rower: false, slitta: false, wallBall: false }
const giorni = { 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] }

const INTERMEDIO = { anniAllenamento: 2, ultimoTempoHyroxMin: 95 }
const PRINCIPIANTE = { anniAllenamento: 0.5, ultimoTempoHyroxMin: null }
const AVANZATO = { anniAllenamento: 5, ultimoTempoHyroxMin: 80 }

function risposte({ obiettivo = 'migliorare', gara = G12, sedute = 4, livello = INTERMEDIO, ...resto } = {}) {
  return {
    obiettivo, gara: obiettivo === 'senza_gara' ? null : gara,
    categoria: { divisione: 'open', formato: 'singolo', sesso: 'uomo' },
    tempoObiettivoMin: null, tempo5kSec: 1500, stazioniDeboli: ['Wall Balls'],
    sedute, giorni: giorni[sedute], minutiSeduta: 70,
    attrezzatura: hyrox, eta: 32, pesoKg: 78, sicurezza: no, esclusioni: [], salute: null,
    ...livello, ...resto,
  }
}

// Storico inventato per l'analisi: tre settimane «troppo dure» o «troppo facili».
const dureONo = (rpe, carichi) => ['2026-11-10', '2026-11-12', '2026-11-14', '2026-11-17', '2026-11-19', '2026-11-21', '2026-11-24', '2026-11-26']
  .map(data => ({ data, status: 'completed', notes: `[RPE: ${rpe}/10]\n${rpe >= 9 ? 'durissima, gambe finite' : 'facile, potevo fare di più'}`, carichi }))
const DURO = dureONo(9, 'meno')
const FACILE = dureONo(4, 'piu')

const caso = (n, atteso, opzioni, extra = {}) => ({ id: `caso-${String(n).padStart(2, '0')}`, atteso, risposte: risposte(opzioni), ...extra })

export const CASI = [
  caso(1, 'migliorare-12x4', {}, { storico: DURO }),
  caso(2, 'migliorare-12x3', { sedute: 3 }, { storico: DURO }),
  caso(3, 'migliorare-12x4', { gara: G14 }),
  caso(4, 'migliorare-12x3', { sedute: 3, gara: G10 }),
  caso(5, 'migliorare-12x4', { sedute: 5 }),
  caso(6, 'migliorare-12x4', { livello: AVANZATO }),
  caso(7, 'migliorare-12x3', { sedute: 2 }),
  caso(8, null, { gara: G5 }),
  caso(9, null, { sedute: 6 }),
  caso(10, null, { gara: G20 }),
  caso(11, 'prima-gara-12x3', { obiettivo: 'prima_gara', sedute: 3, livello: PRINCIPIANTE }),
  caso(12, 'prima-gara-12x3', { obiettivo: 'prima_gara', sedute: 4, livello: PRINCIPIANTE }),
  caso(13, 'prima-gara-12x3', { obiettivo: 'prima_gara', sedute: 3, livello: PRINCIPIANTE, gara: G14 }),
  caso(14, 'prima-gara-12x3', { obiettivo: 'prima_gara', sedute: 3, livello: { anniAllenamento: 2, ultimoTempoHyroxMin: null } }),
  caso(15, null, { obiettivo: 'prima_gara', sedute: 3, livello: AVANZATO }),
  caso(16, null, { obiettivo: 'prima_gara', sedute: 6, livello: PRINCIPIANTE }),
  caso(17, 'senza-gara-8x3', { obiettivo: 'senza_gara', sedute: 3 }, { storico: FACILE }),
  caso(18, 'senza-gara-8x3', { obiettivo: 'senza_gara', sedute: 4 }, { storico: FACILE }),
  caso(19, 'senza-gara-8x3', { obiettivo: 'senza_gara', sedute: 3, livello: PRINCIPIANTE }),
  caso(20, 'senza-gara-8x3', { obiettivo: 'senza_gara', sedute: 2 }),
  caso(21, 'senza-gara-8x3', { sedute: 3, gara: PASSATA }),
  caso(22, 'migliorare-12x4', { attrezzatura: casa }),
  caso(23, 'senza-gara-8x3', { obiettivo: 'senza_gara', sedute: 3, attrezzatura: casa }),
  caso(24, 'prima-gara-12x3', { obiettivo: 'prima_gara', sedute: 3, livello: PRINCIPIANTE, attrezzatura: { ...casa, rower: true } }),
  caso(25, 'migliorare-12x3', { sedute: 3, tempo5kSec: null }),
  caso(26, 'prima-gara-12x3', { obiettivo: 'prima_gara', sedute: 3, livello: PRINCIPIANTE, tempo5kSec: null }),
  caso(27, 'migliorare-12x4', { esclusioni: ['Wall Balls'] }),
  caso(28, 'senza-gara-8x3', { obiettivo: 'senza_gara', sedute: 3, esclusioni: ['Burpees Broad Jumps'] }),
  caso(29, 'migliorare-12x4', { livello: { anniAllenamento: 4, ultimoTempoHyroxMin: 72 }, categoria: { divisione: 'pro', formato: 'singolo', sesso: 'donna' }, pesoKg: 62 }),
  caso(30, 'prima-gara-12x3', { obiettivo: 'prima_gara', sedute: 3, livello: PRINCIPIANTE, categoria: { divisione: 'open', formato: 'doppio', sesso: 'donna' } }),
]
