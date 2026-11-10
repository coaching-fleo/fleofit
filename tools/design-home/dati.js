// Dati finti condivisi dalle tre proposte. Nessuna persona vera: i ritratti sono
if (window.self !== window.top) document.documentElement.classList.add("in-anteprima");
// quelli disegnati della demo (tools/demo-foto). Il giorno è martedì 10 novembre.
window.D = {
  coach: { nome: 'Federico', foto: 'foto/coach-federico.svg' },
  data: 'martedì 10 novembre',
  atletiTotali: 11, inPausa: 1,

  // Colori di categoria (gli stessi di src/index.css)
  cat: {
    Hyrox: { colore: '#f1ba17', nome: 'Hyrox' },
    Corsa: { colore: '#0094C6', nome: 'Corsa' },
    Gym:   { colore: '#14B8A6', nome: 'Gym' },
    Custom:{ colore: '#D11149', nome: 'Libero' },
  },

  // Oggi: chi si allena, con cosa, in che stato. comeSta = sonno, energia, dolori, stress (1–5, 5 = bene)
  oggi: [
    { id: 'marco',  nome: 'Marco Rinaldi',  foto: 'foto/at-marco.svg',  cat: 'Hyrox', titolo: 'Sled & Wall Balls · For Time', min: 55, intensita: 8, stato: 'da fare',   comeSta: [2,2,4,3], allarme: true },
    { id: 'giulia', nome: 'Giulia Ferri',   foto: 'foto/at-giulia.svg', cat: 'Gym',   titolo: 'Forza gambe · 5×5',           min: 60, intensita: 7, stato: 'in corso',  comeSta: [4,4,5,4] },
    { id: 'sara',   nome: 'Sara Conti',     foto: 'foto/at-sara.svg',   cat: 'Corsa', titolo: 'Lungo lento 14 km',           min: 80, intensita: 5, stato: 'fatto', rpe: 6, comeSta: [4,3,3,4] },
    { id: 'luca',   nome: 'Luca Bianchi',   foto: 'foto/at-luca.svg',   cat: 'Hyrox', titolo: 'EMOM 30′ stazioni',           min: 40, intensita: 7, stato: 'fatto', rpe: 9, comeSta: [3,4,4,3] },
    { id: 'chiara', nome: 'Chiara Moretti', foto: 'foto/at-chiara.svg', cat: 'Custom',titolo: 'Mobilità e core',             min: 30, intensita: 4, stato: 'fatto', rpe: 4, comeSta: [5,4,5,5] },
    { id: 'elena',  nome: 'Elena Gallo',    foto: 'foto/at-elena.svg',  cat: 'Corsa', titolo: 'Ripetute 6×1 km',             min: 50, intensita: 8, stato: 'da fare',   comeSta: null },
    { id: 'davide', nome: 'Davide Costa',   foto: 'foto/at-davide.svg', cat: 'Hyrox', titolo: 'Interval Ski + Row',          min: 45, intensita: 6, stato: 'da fare',   comeSta: [4,3,4,2] },
  ],

  // Il polso del team
  polso: {
    aderenza: { pct: 82, delta: +6, barre: [70, 90, 60, 100, 75, 85, 82] },
    comeSta:  { parola: 'Bene', storte: 1, senza: 1 },
    rpe:      { medio: '6,8', previsto: '6,2' },
    gara:     { giorni: 12, nome: 'HYROX Milano', atleti: 3 },
  },

  // Da smaltire: feedback, fermi, scaduti — una lista sola, già in ordine
  daGuardare: [
    { tipo: 'feedback', id: 'sara', nome: 'Sara Conti', foto: 'foto/at-sara.svg', testo: '«Gambe pesanti dopo il 10° km, ho rallentato ma l\'ho chiuso.»', meta: 'Lungo lento · RPE 6 · oggi', vocale: true },
    { tipo: 'feedback', id: 'luca', nome: 'Luca Bianchi', foto: 'foto/at-luca.svg', testo: '«Wall balls devastanti, ma chiuso sotto i 20 minuti.»', meta: 'EMOM 30′ · RPE 9 · oggi' },
    { tipo: 'fermo', id: 'paolo', nome: 'Paolo Ricci', foto: 'foto/at-paolo.svg', testo: 'Nessun allenamento completato da 9 giorni', meta: 'Ultimo: Soglia 3×10′ · 1 nov' },
    { tipo: 'scaduto', id: 'andrea', nome: 'Andrea Greco', foto: 'foto/at-andrea.svg', testo: 'Ripetute 8×400 non segnato', meta: 'Era per ieri · lun 9 nov' },
  ],

  // Da rivedere nel programma: segnali su più sedute
  segnali: [
    { id: 'luca', nome: 'Luca Bianchi', foto: 'foto/at-luca.svg', testo: 'RPE sopra il previsto di +1,8', meta: 'su 4 sedute di fila' },
    { id: 'elena', nome: 'Elena Gallo', foto: 'foto/at-elena.svg', testo: 'Riduce gli affondi', meta: '3 volte in 2 settimane, dalle note' },
  ],

  // Prossimi giorni: atleti × mer/gio/ven. null = da programmare
  giorni: ['Mer 11', 'Gio 12', 'Ven 13'],
  piano: [
    { nome: 'Marco',  foto: 'foto/at-marco.svg',  g: ['Hyrox', null, 'Corsa'] },
    { nome: 'Giulia', foto: 'foto/at-giulia.svg', g: ['Gym', 'Gym', null] },
    { nome: 'Sara',   foto: 'foto/at-sara.svg',   g: [null, 'Corsa', 'Corsa'] },
    { nome: 'Luca',   foto: 'foto/at-luca.svg',   g: ['Hyrox', 'Hyrox', 'Gym'] },
    { nome: 'Elena',  foto: 'foto/at-elena.svg',  g: ['Corsa', null, null] },
    { nome: 'Davide', foto: 'foto/at-davide.svg', g: ['Hyrox', 'Corsa', 'Hyrox'] },
    { nome: 'Sofia',  foto: 'foto/at-sofia.svg',  g: [null, null, null] },
  ],

  // Settimana: % di completamento per giorno (null = futuro)
  settimana: [
    { g: 'L', n: 9,  pct: 100 }, { g: 'M', n: 10, pct: 43, oggi: true },
    { g: 'M', n: 11, pct: null, buchi: 2 }, { g: 'G', n: 12, pct: null, buchi: 3 },
    { g: 'V', n: 13, pct: null, buchi: 2 }, { g: 'S', n: 14, pct: null, buchi: 5 },
    { g: 'D', n: 15, pct: null, buchi: 7 },
  ],

  gare: [
    { nome: 'HYROX Milano', data: 'sab 22 nov', giorni: 12, cat: 'Hyrox', atleti: ['foto/at-marco.svg', 'foto/at-luca.svg', 'foto/at-giulia.svg'] },
    { nome: 'Firenze Marathon', data: 'dom 30 nov', giorni: 20, cat: 'Corsa', atleti: ['foto/at-sara.svg'] },
  ],
};

// Icone: tratti lucide, disegnate a mano qui (nessuna dipendenza)
const P = {
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  manubrio: '<path d="M2.5 12h19"/><rect x="5" y="7" width="3" height="10" rx="1"/><rect x="16" y="7" width="3" height="10" rx="1"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  freccia: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  allarme: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  msg: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  orologio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  bandiera: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  pausa: '<circle cx="12" cy="12" r="10"/><path d="M10 15V9M14 15V9"/>',
  piuma: '<path d="M2 12h4l3-9 6 18 3-9h4"/>',
  scintille: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z"/>',
  onda: '<path d="M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  utente: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  libro: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
};
window.ic = (nome, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[nome] || ''}</svg>`;

// Pezzi comuni
const TONO = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
window.tacche = (cs) => `<span class="tacche" role="img" aria-label="${cs ? 'Come stai: ' + cs.join(', ') : 'Non ha risposto a Come stai'}">${
  [0, 1, 2, 3].map(i => cs ? `<i style="background:${TONO[cs[i] - 1]}"></i>` : '<i class="vuota"></i>').join('')}</span>`;
window.volto = (foto, cls = '') => `<img class="volto ${cls}" src="${foto}" alt="">`;
window.statoTesto = (a) => a.stato === 'fatto' ? `Fatto · RPE ${a.rpe}` : a.stato === 'in corso' ? 'In corso' : 'Da fare';
window.TIPO = {
  feedback: { ico: 'msg', etichetta: 'Feedback', colore: '#f1ba17' },
  fermo:    { ico: 'pausa', etichetta: 'Fermo', colore: '#f97316' },
  scaduto:  { ico: 'orologio', etichetta: 'Scaduto', colore: '#9ca3af' },
};

// Tab bar coach: le stesse cinque voci di oggi; «Workout» diventa il bottone centrale
window.tabBar = (variante = '') => `
  <nav class="barra ${variante}" aria-label="Navigazione">
    <button class="voce attiva">${ic('home')}<span>Home</span></button>
    <button class="voce">${ic('cal')}<span>Calendario</span></button>
    <button class="voce centrale" aria-label="Crea workout">${ic('plus')}</button>
    <button class="voce">${ic('users')}<span>Atleti</span></button>
    <button class="voce">${ic('folder')}<span>Archivio</span></button>
  </nav>`;

// Barra laterale desktop (comune alle tre)
window.lato = () => `
  <aside class="lato">
    <div class="logo">FLEO<b>FIT</b></div>
    <button class="crea">${ic('plus')} Crea workout</button>
    <nav>
      <a class="attiva">${ic('home')} Home</a><a>${ic('cal')} Calendario</a><a>${ic('users')} Atleti</a>
      <a>${ic('folder')} Archivio</a><a>${ic('grafico')} Report</a>
    </nav>
    <div class="io">${volto(D.coach.foto)}<div><b>Federico Leo</b><span>Admin</span></div></div>
  </aside>`;

// Navigazione fra le proposte
window.testataPagina = (lettera, titolo, sotto) => {
  const t = document.createElement('header');
  t.className = 'intestazione';
  t.innerHTML = `
    <div class="riga-int">
      <a href="index.html" class="logo">FLEO<b>FIT</b> <span>· Home coach</span></a>
      <nav class="scelta">${['a', 'b', 'c'].map(l => `<a href="proposta-${l}.html" ${l === lettera ? 'aria-current="page"' : ''}>Proposta ${l.toUpperCase()}</a>`).join('')}</nav>
    </div>
    <h1>${titolo}</h1><p>${sotto}</p>`;
  document.body.prepend(t);
};
