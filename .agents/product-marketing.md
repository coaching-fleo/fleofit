# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-10-22

> Bozza ricavata dal codice e da `PRODUCT.md`, più la ricerca del 22/10/2026
> (`competitor-profiles/_summary.md`). Le voci **MISSING** vanno riempite dai fondatori: non
> sono state stimate. Nome «FLEOFIT» provvisorio: il prodotto sarà rinominato.

## Product Overview
**One-liner:** Il software per coach Hyrox e ibridi che parla Hyrox: scrivi la seduta come la pensi, l'atleta la riceve, la esegue e ti dice com'è andata.
**What it does:** Il coach compone workout nei blocchi veri della disciplina (WarmUp, Cash In, ON/OFF, EMOM, AMRAP, For Time, Interval, Cash Out), fasi di corsa con range di passo e schede Gym, anche dettandoli, generandoli con l'IA o fotografando la lavagna. Li assegna; l'atleta li riceve con una push, li esegue con un timer guidato e li chiude con RPE, note e vocali. Il coach vede tutto in tempo reale, con analisi, «Come stai oggi», calendario e risultati delle gare HYROX.
**Product category:** Software per coach (coaching platform), nicchia Hyrox/allenamento ibrido.
**Product type:** SaaS B2B con app per l'atleta (iOS, Android, web). Multi-coach dal 16/10/2026.
**Business model:** MISSING — nessun prezzo deciso. Ipotesi di lavoro: abbonamento del coach a scaglioni di atleti attivi, atleta gratis.

## Target Audience
**Target companies (ipotesi, da validare):**
1. Coach Hyrox/ibridi **indipendenti** italiani con 5–40 atleti in remoto.
2. **Box / Training Club** italiani con 2–6 coach (il modello admin + coach di oggi ci assomiglia).
**Decision-makers:** il coach stesso; nel box, il titolare.
**Primary use case:** programmare e seguire atleti Hyrox senza WhatsApp + PDF/Excel + app generaliste.
**Jobs to be done:**
- «Scrivere una settimana Hyrox per ogni atleta in poco tempo, senza tradurla in serie × ripetizioni.»
- «Sapere chi si è allenato e come stava senza chiederlo a uno a uno.»
- «Sembrare (ed essere) un coach professionale agli occhi dell'atleta.»
**Use cases:**
- Programmazione verso una gara HYROX con data.
- Sedute di gruppo in box, mostrate sulla TV della sala.
- Coaching in remoto con note vocali.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Coach indipendente | Tempo, immagine professionale, tenere gli atleti | Scrive le schede su WhatsApp/Excel, non sa chi le ha fatte | Una seduta Hyrox scritta in minuti e un resoconto per ogni atleta |
| Titolare di box | Coach allineati, sala piena, atleti che rinnovano | Ogni coach usa strumenti suoi | Un posto solo per tutti i coach, la TV in sala |
| Atleta (utente, non compratore) | Sapere cosa fare oggi | Messaggi sparsi | La scheda chiara, il timer, il coach che risponde |

## Problems & Pain Points
**Core problem:** gli strumenti per coach ragionano in serie × ripetizioni o solo in endurance; Hyrox è corsa + stazioni + formati a tempo, e finisce su WhatsApp e PDF.
**Why alternatives fall short:**
- Generalisti (Trainerize, Everfit, TrueCoach): niente blocchi Hyrox, interfaccia coach in inglese, componenti aggiuntivi a pagamento.
- HYROX Performance Hub: solo per palestre affiliate, programmazione ufficiale più che quella del coach.
- Coachway: Hyrox-nativo ma niente italiano, 69 €/mese per partire.
**What it costs them:** MISSING (ore a settimana per scrivere le schede, atleti persi).
**Emotional tension:** MISSING (da interviste).

## Competitive Landscape
**Direct:** Coachway, Gymkee — Hyrox/ibrido, ma non in italiano (osservato su Coachway).
**Direct (ufficiale):** HYROX Performance Hub 2.0 — gratis per gli affiliati; non serve ai coach non affiliati.
**Secondary:** Trainerize, Everfit, TrueCoach, TrainingPeaks — generalisti o solo endurance.
**Indirect:** WhatsApp + Excel/PDF/Google Docs; app gratuite a sole IA per l'atleta (Runna, ROX AI).

## Differentiation
**Key differentiators (osservati nel codice):**
- Blocchi Hyrox nativi + corsa con range di passo + Gym, in una sola seduta.
- Il workout si crea dettandolo, scrivendolo, con l'IA o da una foto della lavagna.
- Resoconto dell'atleta: RPE, gradimento, vocali, «Come stai oggi», dati estratti dalle note.
- TV della sala e Live Coach Cam.
- Calendario gare HYROX e risultato importato dopo la gara.
- Tutto in italiano.
**How we do it differently:** è nato dentro un coaching vero (16 atleti, 214 workout), non da un elenco di funzioni.
**Why that's better:** MISSING — serve la prova dai coach esterni.
**Why customers choose us:** MISSING.

## Objections
| Objection | Response |
|-----------|----------|
| «Il mio box ha già il Hub HYROX» | MISSING — integrare o differenziare? |
| «Everfit è gratis» | MISSING |
| «E i dati dei miei atleti? Li vedete voi?» | Oggi gli admin vedono tutti gli atleti di tutti i coach: va risolto prima di vendere (vedi Learnings) |
| «È l'app di Federico Leo?» | Va risolto col nuovo nome |

**Anti-persona:** palestre generaliste senza Hyrox; personal trainer solo pesi/estetica; chi vuole un'app per l'atleta senza coach.

## Switching Dynamics
**Push:** schede su WhatsApp che si perdono, niente resoconto, strumenti in inglese.
**Pull:** builder Hyrox, scheda in italiano, l'atleta che risponde da solo.
**Habit:** Excel/Docs già pronti, atleti abituati a WhatsApp.
**Anxiety:** spostare gli atleti, perdere lo storico, un prodotto piccolo che chiude.

## Customer Language
**How they describe the problem:** MISSING — raccogliere frasi testuali da 10 coach.
**How they describe us:** MISSING.
**Words to use:** seduta, scheda, blocchi, stazioni, Cash In/Cash Out, EMOM, RPE, gara.
**Words to avoid:** «piattaforma» generica; il nome del coach nei testi (memoria: mai «Federico»); promettere risposte del coach.
**Glossary:**
| Term | Meaning |
|------|---------|
| Cash In / Cash Out | Blocco di apertura/chiusura del workout Hyrox (termine che non si rinomina) |
| RPE | Fatica percepita 1–10 dichiarata dall'atleta |

## Brand Voice
| Attribute | Means | Doesn't mean | Example line |
|-----------|-------|--------------|--------------|
| Da coach | Diretto, seconda persona | Urlato, motivazionale vuoto | MISSING |
| Preciso | Numeri veri o «—» | Numeri inventati | «Nessuna cella mostra uno zero, e nessun numero si inventa» (regola interna) |

**Terms we own:** MISSING (dopo il nome nuovo).
**Never use (and why):** «Hyrox»/«Rox» nel nome del prodotto — marchio di terzi (rischio, da verificare con un legale).

## Proof Points
**Metrics:** uso interno: 16 atleti attivi, 214 workout (dati della migrazione del 16/10/2026).
**Customers:** nessun coach esterno ancora.
**Testimonials:** MISSING.

## Goals
**Business goal:** MISSING — proposta: 10 coach esterni attivi in 90 giorni, poi i primi paganti.
**Conversion action:** il coach assegna il primo workout ad almeno 3 atleti entro 7 giorni.
**Current metrics:** MISSING.

## Learnings
*Decisions and tested lessons. Newest first. Keep it to about 20 active entries.*
| Date | Learning | Evidence | Applies to | Status |
|------|----------|----------|------------|--------|
| 2026-10-22 | Il multi-coach di oggi è «uno studio con più coach» (gli admin vedono tutto), non uno spazio separato per ogni coach esterno | spec `2026-10-15-multi-coach-design.md`, D2 | vendita, privacy | watch |
| 2026-10-22 | Il concorrente più forte nei box è il Performance Hub di HYROX, incluso nell'affiliazione | hyrox365.com | posizionamento, ICP | watch |

## Changelog
*Newest first. One line per revision: what changed and why.*
- v1 (2026-10-22) — Contesto iniziale: posizionamento come software per coach Hyrox multi-coach, concorrenti dal quick scan.
