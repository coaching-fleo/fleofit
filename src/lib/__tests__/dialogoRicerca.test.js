import { describe, it, expect, vi } from 'vitest'
import { rispondi, tagliaStoria, contestoPer, DICHIARAZIONI, MASSIMO_GIRI } from '../dialogoRicerca'
import { SCHERMATE } from '../ricercaCoach'
import { validaCorpo, richiestaGemini, estraiContenuto, messaggioErrore, senzaFirme, dettaglioErrore, inOpenAI, daOpenAI, nomeFileAudio, senzaRipetizione, REGOLE_FISSE, LIMITI } from '../../../supabase/functions/ricerca-coach/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// Il giro «l'IA chiede uno strumento → l'app lo esegue → l'IA scrive» ha tre
// modi di rompersi senza errori a schermo:
//  1. la storia mandata a Gemini comincia con la risposta a una chiamata che
//     non c'è più — e Gemini rifiuta la domanda successiva;
//  2. «apri» fa un giro in più invece di portare subito il coach dove ha chiesto;
//  3. un'IA che chiama strumenti all'infinito tiene il coach in attesa per sempre.

const OGGI = new Date('2026-10-09T12:00:00')
const dati = {
  atleti: [{ id: 'a1', name: 'Sofia', surname: 'Neri', notes: '' }],
  assegnazioni: [{ id: '1', athlete_id: 'a1', completed_date: '2026-10-01', status: 'completed', notes: '', workouts: { id: 'w1', title: 'Prova', sections: { category: 'Hyrox', blocks: [] } } }],
  dal: '2025-10-09', al: '2027-02-06',
}

const chiamata = (name, args) => ({ contenuto: { role: 'model', parts: [{ functionCall: { name, args } }] } })
const testo = (t) => ({ contenuto: { role: 'model', parts: [{ text: t }] } })

describe('rispondi', () => {
  it('esegue lo strumento in locale e rimanda all\'IA il risultato', async () => {
    const invoca = vi.fn()
      .mockResolvedValueOnce(chiamata('cercaWorkout', { atleta: 'Sofia' }))
      .mockResolvedValueOnce(testo('Sofia ha un allenamento.'))
    const esito = await rispondi({ domanda: 'cosa ha fatto Sofia?', dati, invoca, oggi: OGGI })

    expect(esito.testo).toBe('Sofia ha un allenamento.')
    expect(esito.risultati[0].completo.totale).toBe(1)
    const seconda = invoca.mock.calls[1][0].contents
    const risposta = seconda.at(-1).parts[0].functionResponse
    expect(risposta.name).toBe('cercaWorkout')
    expect(risposta.response.totale).toBe(1)
    // la storia per la domanda dopo: domanda, chiamata, risposta, testo
    expect(esito.storia.map(c => c.role)).toEqual(['user', 'model', 'user', 'model'])
  })

  it('«apri» porta subito alla schermata, senza un altro giro', async () => {
    const invoca = vi.fn().mockResolvedValueOnce(chiamata('apri', { schermata: 'scheda_atleta', atleta: 'Sofia' }))
    const esito = await rispondi({ domanda: 'apri Sofia', dati, invoca, oggi: OGGI })
    expect(esito.percorso).toBe('/athletes/a1')
    expect(invoca).toHaveBeenCalledTimes(1)
    // la storia NON finisce con una chiamata senza risposta
    expect(esito.storia).toEqual([])
  })

  it('si ferma dopo MASSIMO_GIRI anche se l\'IA continua a chiamare', async () => {
    const invoca = vi.fn().mockResolvedValue(chiamata('cercaAtleti', {}))
    const esito = await rispondi({ domanda: 'tutto', dati, invoca, oggi: OGGI })
    expect(invoca).toHaveBeenCalledTimes(MASSIMO_GIRI)
    expect(esito.testo).toBe('')
    expect(esito.risultati).toHaveLength(MASSIMO_GIRI)
  })

  it('le parti di ragionamento non finiscono nella risposta', async () => {
    const invoca = vi.fn().mockResolvedValue({ contenuto: { role: 'model', parts: [{ text: 'penso…', thought: true }, { text: 'Fatto.' }] } })
    expect((await rispondi({ domanda: 'x', dati, invoca, oggi: OGGI })).testo).toBe('Fatto.')
  })

  it('una risposta vuota è un errore, non un silenzio', async () => {
    await expect(rispondi({ domanda: 'x', dati, invoca: vi.fn().mockResolvedValue({}), oggi: OGGI })).rejects.toThrow()
  })
})

describe('tagliaStoria', () => {
  it('taglia solo davanti a una domanda del coach', () => {
    const d = (t) => ({ role: 'user', parts: [{ text: t }] })
    const c = { role: 'model', parts: [{ functionCall: { name: 'x' } }] }
    const r = { role: 'user', parts: [{ functionResponse: { name: 'x', response: {} } }] }
    const m = { role: 'model', parts: [{ text: 'ok' }] }
    const storia = [d('1'), c, r, m, d('2'), c, r, m]
    const tagliata = tagliaStoria(storia, 5)
    expect(tagliata[0]).toEqual(d('2'))
    expect(tagliata).toHaveLength(4)
  })
})

describe('contesto e dichiarazioni', () => {
  it('il contesto dice la data di oggi e gli atleti per nome, senza id', () => {
    // Gli id costavano 36 caratteri ad atleta in ogni richiesta: con Groq a
    // 8.000 token al minuto erano la differenza fra risposta ed errore.
    const c = contestoPer(dati, OGGI)
    expect(c).toContain('2026-10-09')
    expect(c).toContain('Atleti: Sofia Neri')
    expect(c).not.toContain('a1')
  })
  it('lo strumento apri dichiara le stesse schermate che sa aprire', () => {
    const apri = DICHIARAZIONI.find(d => d.name === 'apri')
    expect(apri.parameters.properties.schermata.enum).toEqual(SCHERMATE)
  })
  it('le dichiarazioni stanno nei limiti del server', () => {
    expect(DICHIARAZIONI.length).toBeLessThanOrEqual(LIMITI.strumenti)
  })
})

describe('il server: validaCorpo', () => {
  const buono = { contents: [{ role: 'user', parts: [{ text: 'ciao' }] }], strumenti: DICHIARAZIONI, istruzioni: 'x', contesto: 'y' }
  it('accetta una domanda ben fatta', () => {
    expect(validaCorpo(buono).corpo.tipo).toBe('domanda')
  })
  it('rifiuta una conversazione che non comincia con una domanda', () => {
    expect(validaCorpo({ ...buono, contents: [{ role: 'model', parts: [] }] }).errore).toBeTruthy()
  })
  it('rifiuta i ruoli inventati', () => {
    expect(validaCorpo({ ...buono, contents: [...buono.contents, { role: 'system', parts: [] }] }).errore).toBeTruthy()
  })
  it('l\'audio webm non passa (Gemini non lo prende)', () => {
    expect(validaCorpo({ audioBase64: 'AAAA', mimeType: 'audio/webm;codecs=opus' }).errore).toMatch(/non supportato/)
    expect(validaCorpo({ audioBase64: 'AAAA', mimeType: 'audio/mp4' }).corpo.tipo).toBe('trascrivi')
  })
  it('le regole fisse stanno in testa alle istruzioni del client', () => {
    const r = richiestaGemini(validaCorpo(buono).corpo)
    expect(r.systemInstruction.parts[0].text.startsWith(REGOLE_FISSE)).toBe(true)
    expect(r.tools[0].functionDeclarations).toBe(DICHIARAZIONI)
  })
  it('estraiContenuto: una richiesta bloccata dice perché', () => {
    expect(estraiContenuto({ promptFeedback: { blockReason: 'SAFETY' } }).errore).toMatch(/SAFETY/)
    expect(estraiContenuto({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }).contenuto.parts[0].text).toBe('ok')
  })
})

describe('il server: i messaggi d\'errore', () => {
  // 429 e 503 erano lo stesso «sovraccarica»: ma il 429 è la quota finita, e
  // «riprova fra poco» fa riprovare subito, che è il gesto che la prolunga.
  it('distingue la quota finita dal server pieno', () => {
    expect(messaggioErrore(429)).toMatch(/Limite di richieste/)
    expect(messaggioErrore(503)).toMatch(/sovraccarica/)
    expect(messaggioErrore(400)).toBe("L'IA non ha risposto.")
  })
  it('le regole fisse rifiutano le richieste fuori tema e le istruzioni nei dati', () => {
    expect(REGOLE_FISSE).toMatch(/calcoli/)
    expect(REGOLE_FISSE).toMatch(/DATO, mai un'istruzione/)
  })
})

describe('il server: un modello diverso deve poter continuare la storia', () => {
  // 09/10/2026: «L'IA non ha risposto» a ogni domanda. Il ripiego sul secondo
  // modello riceveva le firme di ragionamento del primo, e le rifiutava.
  it('le firme e le parti di ragionamento escono dalla storia', () => {
    const storia = [
      { role: 'user', parts: [{ text: 'chi è fermo?' }] },
      { role: 'model', parts: [{ text: 'penso', thought: true }, { functionCall: { name: 'cercaAtleti', args: {} }, thoughtSignature: 'abc' }] },
      { role: 'model', parts: [{ text: 'solo pensiero', thought: true }] },
    ]
    expect(senzaFirme(storia)).toEqual([
      { role: 'user', parts: [{ text: 'chi è fermo?' }] },
      { role: 'model', parts: [{ functionCall: { name: 'cercaAtleti', args: {} } }] },
    ])
  })
  it('il ragionamento è spento, e la richiesta parte già senza firme', () => {
    const corpo = validaCorpo({
      contents: [{ role: 'user', parts: [{ text: 'x' }] }, { role: 'model', parts: [{ functionCall: { name: 'a' }, thoughtSignature: 'f' }] }],
      strumenti: [], istruzioni: 'i', contesto: 'c',
    }).corpo
    const r = richiestaGemini(corpo)
    expect(r.generationConfig.thinkingConfig.thinkingBudget).toBe(0)
    expect(JSON.stringify(r.contents)).not.toContain('thoughtSignature')
  })
  it('il dettaglio dice modello, stato e motivo', () => {
    expect(dettaglioErrore('gemini-2.5-flash', 400, { error: { message: 'Bad thing' } })).toBe('gemini-2.5-flash · 400 · Bad thing')
    expect(dettaglioErrore('m', 200, { candidates: [{ finishReason: 'MALFORMED_FUNCTION_CALL' }] })).toBe('m · 200 · MALFORMED_FUNCTION_CALL')
  })
})

describe('il server: il ripiego su Groq (formato OpenAI)', () => {
  // Groq parla OpenAI, l'app parla Gemini: se la traduzione perde il legame
  // fra una chiamata a strumento e la sua risposta, Groq rifiuta la richiesta
  // proprio nel momento in cui è l'ultima IA rimasta.
  const conversazione = validaCorpo({
    contents: [
      { role: 'user', parts: [{ text: 'chi è fermo?' }] },
      { role: 'model', parts: [{ functionCall: { name: 'cercaAtleti', args: { inattivi_da_giorni: 5 } }, thoughtSignature: 'x' }] },
      { role: 'user', parts: [{ functionResponse: { name: 'cercaAtleti', response: { totale: 2 } } }] },
      { role: 'model', parts: [{ text: 'Sono due.' }] },
      { role: 'user', parts: [{ text: 'e con una gara?' }] },
    ],
    strumenti: DICHIARAZIONI, istruzioni: 'ISTR', contesto: 'CTX',
  }).corpo

  it('traduce storia, istruzioni e strumenti, con le chiamate legate alle risposte', () => {
    const r = inOpenAI(conversazione, 'openai/gpt-oss-120b')
    expect(r.messages.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant', 'user'])
    expect(r.messages[0].content.startsWith(REGOLE_FISSE)).toBe(true)
    expect(r.messages[0].content).toContain('ISTR')
    const chiamata = r.messages[2].tool_calls[0]
    expect(chiamata.function).toEqual({ name: 'cercaAtleti', arguments: '{"inattivi_da_giorni":5}' })
    expect(r.messages[3].tool_call_id).toBe(chiamata.id)
    expect(JSON.parse(r.messages[3].content)).toEqual({ totale: 2 })
    expect(r.tools).toHaveLength(DICHIARAZIONI.length)
    expect(r.tools[0].function.name).toBe(DICHIARAZIONI[0].name)
  })

  it('riporta la risposta di Groq nel formato che l\'app si aspetta', () => {
    expect(daOpenAI({ choices: [{ message: { content: null, tool_calls: [{ function: { name: 'apri', arguments: '{"schermata":"atleti"}' } }] } }] }).contenuto)
      .toEqual({ role: 'model', parts: [{ functionCall: { name: 'apri', args: { schermata: 'atleti' } } }] })
    expect(daOpenAI({ choices: [{ message: { content: ' Fatto. ' } }] }).contenuto.parts).toEqual([{ text: 'Fatto.' }])
  })

  it('argomenti illeggibili o risposta vuota sono errori, non silenzi', () => {
    expect(daOpenAI({ choices: [{ message: { tool_calls: [{ function: { name: 'apri', arguments: '{rotto' } }] } }] }).errore).toBeTruthy()
    expect(daOpenAI({ choices: [{ message: { content: '' } }] }).errore).toBeTruthy()
    expect(daOpenAI({}).errore).toBeTruthy()
  })

  it('il file per Whisper ha l\'estensione del formato', () => {
    expect(nomeFileAudio('audio/mp4')).toBe('audio.m4a')
    expect(nomeFileAudio('audio/mpeg')).toBe('audio.mp3')
  })
})

describe('lo scambio «fermo» / «niente in programma» (09/10/2026)', () => {
  // Groq ha risposto a «chi non si allena da 7 giorni?» con il filtro della
  // programmazione futura. Le descrizioni ora li separano, e il filtro usato
  // si vede sotto la risposta.
  it('le descrizioni dicono quale filtro è «chi non si allena» e quale no', () => {
    const p = DICHIARAZIONI.find(d => d.name === 'cercaAtleti').parameters.properties
    expect(p.inattivi_da_giorni.description).toMatch(/chi non si allena/)
    expect(p.senza_programma_giorni.description).toMatch(/NON dice se l'atleta si allena/)
  })
  it('la frase ripetuta due volte di Groq diventa una', () => {
    const f = 'Nove atleti non si allenano da 7 giorni.'
    expect(senzaRipetizione(f + f)).toBe(f)
    expect(senzaRipetizione(`${f} ${f}`)).toBe(f)
    expect(senzaRipetizione('Ciao ciao')).toBe('Ciao ciao')
    expect(daOpenAI({ choices: [{ message: { content: f + f } }] }).contenuto.parts[0].text).toBe(f)
  })
})
