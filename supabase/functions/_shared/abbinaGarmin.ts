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
export const FRAZIONE_STIMA = 0.5;

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
  x: { attivita: RigaAttivita; candidati: Candidato[]; collegatoAt: string },
): string | null {
  const { attivita: a, candidati, collegatoAt } = x;
  // Già abbinata, o rifiutata con «Non era questo» (abbinamento valorizzato, id nullo).
  if (a.athlete_workout_id || a.abbinamento) return null;
  // Il backfill si mostra ma non completa. Confronto fra istanti, non fra stringhe.
  if (Date.parse(a.inizio) < Date.parse(collegatoAt)) return null;
  if (a.durata_s == null || a.durata_s < MINUTI_MINIMI * 60) return null;
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
