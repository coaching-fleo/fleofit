# FLEOFIT 🏋️‍♂️

FLEOFIT è una piattaforma avanzata per il fitness coaching, progettata specificamente per atleti e allenatori focalizzati su discipline come l'**Hyrox** e il **Running**. Creata con un'interfaccia moderna in puro stile app nativa, l'applicazione offre un'esperienza utente premium, fluida e altamente interattiva sia per il coach che per l'atleta.

## 🌟 Caratteristiche Principali

### Per l'Atleta 🏃
*   **Dashboard Intuitiva:** Una Home page personalizzata che accoglie l'atleta con motivazioni giornaliere dinamiche e mostra a colpo d'occhio l'andamento della settimana tramite un elegante tracker ad anelli.
*   **Allenamento del Giorno:** Accesso immediato al workout previsto per la giornata, con un'interazione gratificante per segnare gli allenamenti come completati.
*   **Dettaglio Workout:** Visualizzazione chiara dei blocchi di allenamento (EMOM, AMRAP, For Time, Ripetute Corsa, ecc.) con indicazioni precise su carichi, ritmi, intensità percepita ed esercizi.
*   **Condivisione Social & PDF:** Possibilità di generare istantaneamente una grafica riassuntiva in formato "Instagram Story" per condividere il proprio allenamento, o esportare la scheda dettagliata in PDF.
*   **Gestione Profilo:** Sistema di onboarding per inserire i dati biometrici, caricare la foto profilo e tenere traccia del proprio diario degli allenamenti.

### Per il Coach (Admin) 📋
*   **Workout Builder Avanzato:** Un compositore di allenamenti visuale con funzionalità drag-and-drop per creare schede complesse. Supporta due modalità principali:
    *   **Hyrox:** Gestione di blocchi specifici come WarmUp, Cash In, EMOM, AMRAP, For Time, Rest e Cash Out. Database integrato di decine di esercizi specifici.
    *   **Running:** Compositore dettagliato di fasi di corsa (Riscaldamento, Corsa, Recupero, Ripetute, Defaticamento) con gestione avanzata di ritmi (Pace/Zone) e durate.
*   **Gestione Atleti:** Rubrica completa degli atleti iscritti, visualizzazione rapida dei loro progressi, inserimento note private e storico degli allenamenti.
*   **Assegnazione Dinamica:** Assegnazione rapida dei workout dall'Archivio Storico all'atleta scegliendo la data esatta tramite un DatePicker personalizzato.
*   **Backup e Sicurezza:** Sistema integrato per esportare e importare l'intero database in formato JSON locale, o scaricare il backup isolato di un singolo atleta.

## 🛠️ Stack Tecnologico

Il progetto è costruito con tecnologie moderne per garantire prestazioni ottimali:

*   **Frontend:** [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
*   **Styling & UI:** [Tailwind CSS](https://tailwindcss.com/) (con animazioni gestite via plugin e componenti custom)
*   **Backend / Database / Auth:** [Supabase](https://supabase.com/)
    *   Autenticazione sicura (Email/Password, Google OAuth).
    *   Database Relazionale PostgreSQL (Tabelle per Atleti, Workouts, Relazioni di assegnazione).
    *   Storage Bucket per la gestione sicura delle foto profilo.
*   **Iconografia:** [Lucide React](https://lucide.dev/)
*   **Gestione Date:** [date-fns](https://date-fns.org/)
*   **Motore di Esportazione:** `jsPDF` (per i documenti stampabili) e `html2canvas` (per la rasterizzazione grafica per i social).