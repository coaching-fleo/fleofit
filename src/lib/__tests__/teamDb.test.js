import { describe, it, expect, vi, beforeEach } from 'vitest'

// Accesso ai dati del team (06/11/2026): chi riceve una sfida, cosa si scrive
// quando l'atleta risponde, che la notifica non blocchi l'invito, e che le
// tabelle assenti (migrazione non applicata) non siano un errore.

const ctrl = await vi.hoisted(async () => ({ tabelle: {}, guasti: [], codice: undefined }))
const finti = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const crea = (codiceErrore) => fintoSupabase(() => ctrl.tabelle, { erroreSu: () => ctrl.guasti, codiceErrore })
  return { generico: crea(undefined), assente: crea('PGRST205') }
})
const attivo = () => (ctrl.codice ? finti.assente : finti.generico)
vi.mock('../../supabaseClient', () => ({ supabase: {
  from: (t) => attivo().supabase.from(t),
  rpc: (...a) => attivo().supabase.rpc(...a),
  functions: { invoke: (...a) => attivo().supabase.functions.invoke(...a) },
  auth: { getUser: () => attivo().supabase.auth.getUser() },
} }))

const { creaSfida, assegnaInsieme, leggiMieiTeam, invita, rispondi, leggiScheda, salvaRisultato, sfidaDiAssegnazione } = await import('../teamDb')

beforeEach(() => {
  ctrl.tabelle = {}
  ctrl.guasti = []
  ctrl.codice = undefined
  for (const f of Object.values(finti)) {
    f.chiamate.length = 0
    f.supabase.functions.invoke.mockReset()
    f.supabase.functions.invoke.mockImplementation(() => Promise.resolve({ data: null, error: null }))
  }
})

// Il coach del team e i suoi atleti (il finto client non filtra: solo le righe giuste).
const DEL_COACH = (ids) => ({
  team: [{ id: 't1', coach_id: 'c1' }],
  coach_atleti: ids.map(athlete_id => ({ athlete_id, coach_id: 'c1' })),
})

describe('teamDb', () => {
  it('creaSfida assegna il workout solo a chi è dentro', async () => {
    ctrl.tabelle = {
      team_membri: [
        { atleta_id: 'a', stato: 'dentro' }, { atleta_id: 'b', stato: 'dentro' }, { atleta_id: 'c', stato: 'invitato' },
      ],
      team_sfide: [{ id: 's1' }],
      athlete_workouts: [],
      ...DEL_COACH(['a', 'b', 'c']),
    }
    const r = await creaSfida({ teamId: 't1', workoutId: 'w1', metrica: 'tempo', data: '2026-11-06' })
    expect(r.assegnati).toEqual(['a', 'b'])
    const ins = finti.generico.chiamateA('athlete_workouts', 'insert')
    expect(ins).toHaveLength(1)
    expect(ins[0].args[0].map(x => x.athlete_id)).toEqual(['a', 'b'])
    expect(ins[0].args[0][0]).toMatchObject({ workout_id: 'w1', completed_date: '2026-11-06', status: 'pending' })
    const sfida = finti.generico.chiamateA('team_sfide', 'insert')[0].args[0]
    expect(sfida).toMatchObject({ team_id: 't1', workout_id: 'w1', metrica: 'tempo', verso: 'minore', data: '2026-11-06' })
  })

  it('creaSfida non riassegna a chi ha già quel workout quel giorno', async () => {
    ctrl.tabelle = {
      team_membri: [{ atleta_id: 'a', stato: 'dentro' }, { atleta_id: 'b', stato: 'dentro' }],
      team_sfide: [{ id: 's1' }],
      athlete_workouts: [{ athlete_id: 'a', workout_id: 'w1', completed_date: '2026-11-06' }],
      ...DEL_COACH(['a', 'b']),
    }
    const r = await creaSfida({ teamId: 't1', workoutId: 'w1', metrica: 'kg', data: '2026-11-06' })
    expect(r.assegnati).toEqual(['b'])
  })

  // Revisione 09/11: un membro «dentro» passato a un altro coach non si può più
  // assegnare (la RLS di athlete_workouts lo rifiuta) e faceva fallire tutta la sfida.
  it('creaSfida salta chi è dentro ma non segue più il coach del team', async () => {
    ctrl.tabelle = {
      team_membri: [{ atleta_id: 'a', stato: 'dentro' }, { atleta_id: 'spostato', stato: 'dentro' }],
      team_sfide: [{ id: 's1' }],
      athlete_workouts: [],
      ...DEL_COACH(['a']),
    }
    const r = await creaSfida({ teamId: 't1', workoutId: 'w1', metrica: 'tempo', data: '2026-11-06' })
    expect(r.assegnati).toEqual(['a'])
  })

  it('assegnaInsieme assegna a chi è dentro e segue il coach, senza creare una sfida', async () => {
    ctrl.tabelle = {
      team_membri: [{ atleta_id: 'a', stato: 'dentro' }, { atleta_id: 'b', stato: 'invitato' }, { atleta_id: 'spostato', stato: 'dentro' }],
      athlete_workouts: [],
      ...DEL_COACH(['a', 'b']),
    }
    const r = await assegnaInsieme({ teamId: 't1', workoutId: 'w1', data: '2026-11-09' })
    expect(r.assegnati).toEqual(['a'])
    expect(finti.generico.chiamateA('team_sfide', 'insert')).toHaveLength(0)
    const ins = finti.generico.chiamateA('athlete_workouts', 'insert')
    expect(ins[0].args[0]).toEqual([{ athlete_id: 'a', workout_id: 'w1', completed_date: '2026-11-09', status: 'pending' }])
  })

  it('creaSfida: se le assegnazioni falliscono, la sfida non resta orfana', async () => {
    ctrl.tabelle = {
      team_membri: [{ atleta_id: 'a', stato: 'dentro' }],
      team_sfide: [{ id: 's1' }],
      athlete_workouts: [],
      ...DEL_COACH(['a']),
    }
    // Fallisce solo la scrittura: la lettura di chi l'ha già passa.
    let letture = 0
    const vero = finti.generico.supabase.from
    finti.generico.supabase.from = (t) => {
      if (t === 'athlete_workouts' && letture++ > 0) {
        return { insert: () => ({ select: async () => ({ data: null, error: { message: 'rls' } }) }) }
      }
      return vero(t)
    }
    try {
      await expect(creaSfida({ teamId: 't1', workoutId: 'w1', metrica: 'tempo', data: '2026-11-06' })).rejects.toBeTruthy()
    } finally {
      finti.generico.supabase.from = vero
    }
    expect(finti.generico.chiamateA('team_sfide', 'delete')).toHaveLength(1)
  })

  it('leggiMieiTeam con la tabella assente risponde «non disponibile», senza lanciare', async () => {
    ctrl.codice = 'assente'
    ctrl.guasti = ['team']
    await expect(leggiMieiTeam()).resolves.toEqual({ disponibile: false, team: [] })
  })

  it('leggiMieiTeam conta dentro e in attesa per team', async () => {
    ctrl.tabelle = {
      team: [{ id: 't1', nome: 'Doppia', evento_id: null, classifica_visibile: true, chiuso_il: null,
        team_membri: [{ stato: 'dentro' }, { stato: 'dentro' }, { stato: 'invitato' }, { stato: 'rifiutato' }] }],
    }
    const r = await leggiMieiTeam()
    expect(r.team[0]).toMatchObject({ id: 't1', dentro: 2, inAttesa: 1 })
  })

  it('invita manda la notifica team_invito, e non fallisce se la notifica fallisce', async () => {
    ctrl.tabelle = { team_membri: [] }
    finti.generico.supabase.functions.invoke.mockImplementation(() => Promise.reject(new Error('rete')))
    const r = await invita('t1', ['a', 'b'])
    expect(r.invitati).toEqual(['a', 'b'])
    expect(finti.generico.supabase.functions.invoke).toHaveBeenCalledWith('send-reminders',
      { body: { mode: 'team_invito', team_id: 't1', atleta_ids: ['a', 'b'] } })
  })

  it('invita reinvita chi ha rifiutato da 3 giorni e salta chi è già dentro', async () => {
    const vecchio = new Date(Date.now() - 4 * 86400000).toISOString()
    const recente = new Date(Date.now() - 1 * 86400000).toISOString()
    ctrl.tabelle = { team_membri: [
      { atleta_id: 'r', stato: 'rifiutato', risposto_il: vecchio },
      { atleta_id: 'q', stato: 'rifiutato', risposto_il: recente },
      { atleta_id: 'd', stato: 'dentro' },
    ] }
    const r = await invita('t1', ['r', 'q', 'd', 'n'])
    expect(r.invitati).toEqual(['r', 'n'])
    expect(finti.generico.chiamateA('team_membri', 'insert')[0].args[0]).toEqual([{ team_id: 't1', atleta_id: 'n', stato: 'invitato' }])
    expect(finti.generico.chiamateA('team_membri', 'update')[0].args[0]).toEqual({ stato: 'invitato' })
  })

  it('rispondi aggiorna la riga del team E dell\'atleta', async () => {
    await rispondi('t1', 'a', 'dentro')
    const ch = finti.generico.chiamate.filter(c => c.tabella === 'team_membri')
    expect(ch.find(c => c.metodo === 'update').args[0]).toEqual({ stato: 'dentro' })
    const filtri = ch.filter(c => c.metodo === 'eq').map(c => c.args)
    expect(filtri).toEqual(expect.arrayContaining([['team_id', 't1'], ['atleta_id', 'a']]))
  })

  it('rispondi rifiuta uno stato che non esiste', async () => {
    await expect(rispondi('t1', 'a', 'boh')).rejects.toThrow()
  })

  it('leggiScheda passa da team_scheda', async () => {
    ctrl.tabelle = { 'rpc:team_scheda': { team: { nome: 'Doppia' }, membri: [] } }
    const r = await leggiScheda('t1')
    expect(r).toEqual({ disponibile: true, scheda: { team: { nome: 'Doppia' }, membri: [] } })
  })

  it('leggiScheda con la funzione assente risponde «non disponibile»', async () => {
    ctrl.tabelle = { 'rpc:team_scheda': { error: { code: 'PGRST202' } } }
    await expect(leggiScheda('t1')).resolves.toEqual({ disponibile: false, scheda: null })
  })

  it('salvaRisultato fa un upsert del proprio valore', async () => {
    await salvaRisultato('s1', 'a', 247)
    const up = finti.generico.chiamateA('team_risultati', 'upsert')[0]
    expect(up.args[0]).toMatchObject({ sfida_id: 's1', atleta_id: 'a', valore: 247, fonte: 'manuale' })
  })

  it('sfidaDiAssegnazione: nessuna sfida → null; tabella assente → null', async () => {
    ctrl.tabelle = { team_sfide: [] }
    await expect(sfidaDiAssegnazione('w1', 'a')).resolves.toBeNull()
    ctrl.codice = 'assente'
    ctrl.guasti = ['team_sfide']
    await expect(sfidaDiAssegnazione('w1', 'a')).resolves.toBeNull()
  })

  it('sfidaDiAssegnazione porta metrica, classifica e il valore già scritto', async () => {
    ctrl.tabelle = {
      team_sfide: [{ id: 's1', metrica: 'tempo', chiusa_il: null, team: { classifica_visibile: true } }],
      team_risultati: [{ valore: 300 }],
    }
    await expect(sfidaDiAssegnazione('w1', 'a')).resolves.toEqual(
      { id: 's1', metrica: 'tempo', chiusa_il: null, classifica_visibile: true, valore: 300 })
  })
})
