// Le regole che decidono se un'attività di Garmin completa un workout assegnato.
// Pure, senza Deno né rete: le chiama il webhook (Task 5) e le prova Vitest.
// Spec §3, «Completamento automatico».

// ⚠️ DA VERIFICARE: i valori di `activityType` non sono elencati nello Swagger di Garmin.
// Sono quelli noti; si correggono al primo test vero leggendo `tipo` in `garmin_attivita`
// (docs/memoria/garmin.md, «Fase 1 · formato verificato»).
const CORSA = ['RUNNING', 'TRAIL_RUNNING', 'TREADMILL_RUNNING', 'TRACK_RUNNING'];

/** Custom ed Event non ci sono: non si completano mai in automatico. */
export const TIPI_PER_CATEGORIA: Record<'Running' | 'Hyrox' | 'Gym', string[]> = {
  Running: [...CORSA],
  Hyrox: [...CORSA, 'INDOOR_CARDIO', 'HIIT', 'STRENGTH_TRAINING', 'INDOOR_ROWING', 'OTHER'],
  Gym: ['STRENGTH_TRAINING', 'INDOOR_CARDIO', 'HIIT'],
};

export const MINUTI_MINIMI = 10;

/**
 * La soglia in minuti dal secret GARMIN_MINUTI_MINIMI: SOLO per le prove (il 30/10/2026
 * lo si mette a 1 per completare i workout da 1 minuto). Vale un intero da 1 a 60;
 * assente o sbagliato = MINUTI_MINIMI. Prima della produzione il secret si cancella.
 */
export function minutiMinimi(valore: string | undefined): number {
  const v = (valore ?? '').trim();
  if (!/^\d+$/.test(v)) return MINUTI_MINIMI;
  const n = Number(v);
  return n >= 1 && n <= 60 ? n : MINUTI_MINIMI;
}
export const FRAZIONE_STIMA = 0.5;
/**
 * Un'attività più vecchia di così, quando arriva, non completa niente: è il
 * backfill di un RIcollegamento (che tiene il `collegato_at` di prima) o una
 * sincronizzazione molto tardiva. Una settimana copre il viaggio senza telefono.
 */
export const GIORNI_MASSIMI = 7;

export type Candidato = {
  id: string;
  giorno: string;
  categoria: string | null;
  completato: boolean;
  durataStimataMin: number | null;
};

type RigaAttivita = {
  giorno: string;
  tipo: string;
  durata_s: number | null;
  inizio: string;
  abbinamento: string | null;
  athlete_workout_id: string | null;
};

/** L'id dell'assegnazione che l'attività completa, o null se non se ne può scegliere una sola. */
export function scegliAbbinamento(
  x: { attivita: RigaAttivita; candidati: Candidato[]; collegatoAt: string; adesso?: string; minutiMinimi?: number },
): string | null {
  const { attivita: a, candidati, collegatoAt, adesso, minutiMinimi = MINUTI_MINIMI } = x;
  // Già abbinata, o rifiutata con «Non era questo» (abbinamento valorizzato, id nullo).
  if (a.athlete_workout_id || a.abbinamento) return null;
  // Il backfill si mostra ma non completa. Confronto fra istanti, non fra stringhe.
  if (Date.parse(a.inizio) < Date.parse(collegatoAt)) return null;
  if (adesso && Date.parse(a.inizio) < Date.parse(adesso) - GIORNI_MASSIMI * 86400_000) return null;
  if (a.durata_s == null || a.durata_s < minutiMinimi * 60) return null;
  const durata = a.durata_s;

  const giusti = candidati.filter((c) => {
    if (c.giorno !== a.giorno || c.completato) return false;
    const tipi = c.categoria ? (TIPI_PER_CATEGORIA as Record<string, string[]>)[c.categoria] : undefined;
    if (!tipi || !tipi.includes(a.tipo)) return false;
    if (c.durataStimataMin != null && durata < FRAZIONE_STIMA * c.durataStimataMin * 60) return false;
    return true;
  });
  return giusti.length === 1 ? giusti[0].id : null;
}
