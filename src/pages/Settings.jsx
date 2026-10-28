import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useIndietro } from '../useIndietro'
import { UserCheck, HardDriveDownload, Eye, EyeOff, KeyRound, X, Bell, BellRing, Ticket, Wrench, Trash2, LifeBuoy, Users, ShieldCheck, ShieldOff, Watch } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import { useAuth } from '../App'
import { eStaff, eAdmin } from '../lib/ruoli'
import { useSchermoLargo, eDesktop } from '../useDesktop'
import { esportaTutto, scriviTutta } from '../lib/backup'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
import { FCM } from '@capacitor-community/fcm'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Browser } from '@capacitor/browser'
import { CHIAVE_ULTIMO_EXPORT, etichettaRuolo, riassuntoBackup, riassuntoCodici, senzaPassword } from '../lib/rigaImpostazioni'
import { CARD } from '../lib/stiliCard'
import {
  BottoneEsci, CartaAccount, EtichettaSezione, FoglioCodici, PiediPagina, RigaAzione, RigaInterruttore,
  RigaPericolo, RigaPieghevole, Separatore, Sezione, TestataImpostazioni,
} from '../components/ImpostazioniUI'
import FoglioSegnalazione from '../components/FoglioSegnalazione'
import FoglioGarmin from '../components/FoglioGarmin'
import { FoglioGestioneCoach } from '../components/FoglioCoach'
import { aggiungiCoach, togliCoach, normalizzaEmail } from '../lib/coachAtleti'
import { datiTecnici } from '../lib/segnalazione'
import { dataConsenso } from '../lib/consenso'
import { apriInformativa } from '../lib/informativa'
import { leggiCoda } from '../lib/offlineQueue'
import { VERSIONE_CONSENSO_GARMIN, dataCollegamento, leggiStatoGarmin, messaggioEsito, ritornoGarmin } from '../lib/garmin'

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const indietro = useIndietro('/')
  // ⚠️ Un solo stato per «cosa sta girando», e NON un booleano: è ciò che
  // permette alla rotella di stare nella riga che l'ha causata invece che nel
  // banner giallo «Operazione in corso, attendere prego...» in cima alla
  // pagina. Con nove comandi in pagina, uno stato di caricamento staccato
  // dalla causa costringe a ricordarsi cosa si è appena premuto.
  const [operazione, setOperazione] = useState(null)
  const loading = operazione !== null
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)
  const athleteImportRef = useRef(null)
  const { role, user, nome } = useAuth()
  // Sul desktop (solo coach, src/useDesktop.js) la pagina va su due colonne.
  const desktop = eDesktop(useSchermoLargo(), role)
  const isSimulatingAthlete = localStorage.getItem('adminRoleOverride') === 'athlete'
  // Solo admin (D9). Mentre si simula l'atleta il ruolo è `athlete`, ma
  // l'interruttore deve restare per tornare indietro: l'override lo applica
  // `App.jsx` ai soli admin, quindi se c'è, chi guarda è un admin.
  const adminReale = eAdmin(role) || (role === 'athlete' && isSimulatingAthlete)
  // L'informativa per tutti; il consenso e Garmin solo per l'atleta vero (non
  // l'admin in anteprima, che il consenso non lo dà: src/lib/consenso.js, e
  // che non deve collegare il proprio Garmin a un atleta per sbaglio).
  const atletaVero = role === 'athlete' && !isSimulatingAthlete
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  // Account nato da Apple o Google: niente password attuale da chiedere, e la
  // riga spiega a cosa serve sceglierne una (lib/rigaImpostazioni.js).
  const primaPassword = senzaPassword(user)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  const [sviluppoAperto, setSviluppoAperto] = useState(false)
  const [foglioCodiciAperto, setFoglioCodiciAperto] = useState(false)
  const [foglioSegnalazioneAperto, setFoglioSegnalazioneAperto] = useState(false)
  const [codici, setCodici] = useState(null)
  // Gestione dei coach (solo admin): `staff` è null finché non è letto.
  const [foglioCoachAperto, setFoglioCoachAperto] = useState(false)
  const [staff, setStaff] = useState(null)
  const [conteggiCoach, setConteggiCoach] = useState({})
  const [erroreStaff, setErroreStaff] = useState(null)
  const [occupatoCoach, setOccupatoCoach] = useState(false)
  // Parte già a `true` per il coach: la lista si chiede al montaggio, e
  // accenderlo dentro `caricaCodici` renderebbe quella funzione un setState
  // sincrono dentro un effetto (react-hooks/set-state-in-effect).
  const [codiciInCaricamento, setCodiciInCaricamento] = useState(eStaff(role))
  const [conteggi, setConteggi] = useState({ atleti: null, workout: null })
  const [ultimoExport, setUltimoExport] = useState(() => {
    try { return localStorage.getItem(CHIAVE_ULTIMO_EXPORT) } catch { return null }
  })
  const [versione, setVersione] = useState(null)
  // Garmin Connect (src/lib/garmin.js). `disponibile: false` finché non è letto,
  // e per sempre se `stato_garmin` non esiste ancora: la riga semplicemente non c'è.
  const [garmin, setGarmin] = useState({ disponibile: false, stato: null, dal: null, permessi: [] })
  const [foglioGarminAperto, setFoglioGarminAperto] = useState(false)

  useEffect(() => {
    if (!atletaVero || !user?.id) return
    let vivo = true
    leggiStatoGarmin(supabase, user.id).then(s => { if (vivo) setGarmin(s) })
    return () => { vivo = false }
  }, [atletaVero, user?.id])

  /**
   * Il ritorno da Garmin: `/settings?garmin=ok|errore[&motivo=…]`, dal sito
   * direttamente o dal deep link `fleofit://garmin` (App.jsx, DeeplinkHandler).
   * Si pulisce subito l'indirizzo (`replace`: un «indietro» non deve rimostrare
   * l'esito), si rilegge lo stato e POI si mostra il messaggio.
   * ⚠️ Niente `vivo` qui: pulire l'indirizzo rifà girare l'effetto, e un
   * cleanup che spegne la promessa farebbe sparire il messaggio.
   */
  const parametri = new URLSearchParams(location.search)
  const esitoGarmin = parametri.get('garmin')
  const motivoGarmin = parametri.get('motivo')
  useEffect(() => {
    if (!esitoGarmin) return
    const info = messaggioEsito(esitoGarmin, motivoGarmin)
    navigate('/settings', { replace: true })
    const rilettura = atletaVero && user?.id ? leggiStatoGarmin(supabase, user.id) : Promise.resolve(null)
    rilettura.then(s => {
      if (s) setGarmin(s)
      setAlertInfo(info)
    })
  }, [esitoGarmin, motivoGarmin, atletaVero, user?.id, navigate])

  useEffect(() => {
    const checkSubscription = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const permStatus = await PushNotifications.checkPermissions()
          setNotificationsEnabled(permStatus.receive === 'granted')
        } catch (e) {
          console.error(e)
        }
      } else {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            const subscription = await registration.pushManager.getSubscription()
            setNotificationsEnabled(!!subscription)
          }
        }
      }
    }
    checkSubscription()
  }, [])

  /**
   * La versione arriva dal bundle NATIVO, non da una costante scritta qui.
   * `package.json` dice `0.0.0` e il numero vero vive nel `pbxproj`, che Xcode
   * incrementa da solo a ogni archive (CLAUDE.md §9-ter): una copia a mano qui
   * sarebbe un numero destinato a essere sbagliato. Sul web la riga non compare.
   */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    CapApp.getInfo()
      .then(info => setVersione(`FLEOFIT ${info.version} · build ${info.build}`))
      .catch(e => console.error('Versione app non letta:', e))
  }, [])

  /**
   * I due conteggi che la riga «Esporta database» mostra: sono quelli GREZZI
   * delle tabelle, cioè esattamente ciò che finisce nel .json. Due `head: true`,
   * quindi nessuna riga scaricata.
   */
  useEffect(() => {
    if (!eAdmin(role)) return
    let vivo = true
    Promise.all([
      supabase.from('athletes').select('id', { count: 'exact', head: true }),
      supabase.from('workouts').select('id', { count: 'exact', head: true }),
    ]).then(([a, w]) => {
      if (!vivo) return
      setConteggi({ atleti: a?.count ?? null, workout: w?.count ?? null })
    }).catch(e => console.error('Conteggi per la riga di export non letti:', e))
    return () => { vivo = false }
  }, [role])

  /**
   * I codici invito si leggono una volta all'apertura della pagina, non
   * all'apertura del foglio: il numero della riga («3 attivi · 11 usati») deve
   * esserci PRIMA che qualcuno la tocchi, o la riga non dice niente più di
   * quanto dicesse la card di prima.
   *
   * ⚠️ Le due colonne mostrate nel foglio (chi ha riscattato, quando) sono già
   * formattate qui: `FoglioCodici` è sola presentazione e non deve conoscere
   * né `date-fns` né lo schema di `invitation_codes`.
   */
  const caricaCodici = useCallback(async () => {
    const { data, error } = await supabase
      .from('invitation_codes').select('*').order('created_at', { ascending: false })

    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
      setCodiciInCaricamento(false)
      return
    }

    const righe = data || []
    const idRiscattati = righe.filter(c => c.used_by).map(c => c.used_by)
    let nomi = {}
    if (idRiscattati.length > 0) {
      const { data: atleti } = await supabase.from('athletes').select('id, name, surname').in('id', idRiscattati)
      ;(atleti || []).forEach(a => { nomi[a.id] = `${a.name} ${a.surname}` })
    }

    setCodici(righe.map(c => ({
      ...c,
      riscattato_da: nomi[c.used_by] || c.used_by_email || null,
      riscattato_il: dataRiscatto(c.used_at),
    })))
    setCodiciInCaricamento(false)
  }, [])

  useEffect(() => {
    if (eStaff(role)) caricaCodici()
  }, [role, caricaCodici])
  const handleExportFull = async () => {
    setOperazione('export')
    try {
      // A pagine e con «Come stai oggi» (src/lib/backup.js): prima `.limit(10000)`
      // si fermava a mille righe senza dirlo, e il file usciva troncato.
      const backup = await esportaTutto()

      // Salviamo in un file JSON
      const dataStr = JSON.stringify(backup, null, 2)
      const fileName = `FLEOFIT_Full_Backup_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`

      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: dataStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        })
        await Share.share({ title: 'Backup FLEOFIT', files: [result.uri] })
      } else {
        const blob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.click()
        URL.revokeObjectURL(url)
      }
      // ⚠️ Memoria LOCALE, non un registro dei backup: dice «l'hai esportato
      // da questo iPhone», che è l'unica cosa che si possa sapere senza una
      // colonna nuova (schema congelato, CLAUDE.md regola 0-bis).
      const quando = new Date().toISOString()
      try { localStorage.setItem(CHIAVE_ULTIMO_EXPORT, quando); setUltimoExport(quando) } catch (err) {
        // Un localStorage pieno o negato non è una ragione per dire che
        // l'export è fallito: il file è già stato scritto.
        console.error('Data dell\'ultimo export non salvata:', err)
      }
    } catch (e) {
      setAlertInfo({ title: 'Errore', message: "Errore esportazione: " + e.message, type: 'error' })
    }
    setOperazione(null)
  }

  const handleImportAthlete = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setOperazione('importAtleta')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.athlete || !data.athlete.id) throw new Error("File atleta non valido o corrotto.")
      
      const { error: errA } = await supabase.from('athletes').upsert([data.athlete], { onConflict: 'id' })
      if (errA) throw new Error("Errore salvataggio atleta: " + errA.message)
      
      if (data.workouts?.length) {
        const awRecords = data.workouts.map(w => ({
          id: w.id,
          athlete_id: data.athlete.id,
          workout_id: w.workouts?.id,
          completed_date: w.completed_date,
          notes: w.notes,
          status: w.status
        })).filter(aw => aw.workout_id)
        
        if (awRecords.length > 0) {
          const { error: errW } = await supabase.from('athlete_workouts').upsert(awRecords, { onConflict: 'id' })
          if (errW) throw new Error("Errore salvataggio assegnazioni: " + errW.message)
        }
      }
      // «Come stai oggi», presente nei file esportati dal 13/10/2026.
      if (data.come_stai?.length) await scriviTutta('come_stai', data.come_stai)
      
      setAlertInfo({ title: 'Completato', message: `Profilo di ${data.athlete.name} ${data.athlete.surname} ripristinato con successo!`, type: 'success' })
    } catch (err) {
      setAlertInfo({ title: 'Errore', message: "Errore importazione atleta: " + err.message, type: 'error' })
    }
    setOperazione(null)
    e.target.value = ''
  }

  const toggleSimulateAthlete = () => {
    if (isSimulatingAthlete) {
      localStorage.removeItem('adminRoleOverride')
    } else {
      localStorage.setItem('adminRoleOverride', 'athlete')
    }
    window.location.href = '/'
  }

  const handleLogout = async () => {
    setConfirmInfo({
      title: "Uscita",
      message: "Sei sicuro di voler uscire dal tuo account?",
      onConfirm: async () => {
        await supabase.auth.signOut()
        navigate('/login')
      }
    })
  }

  /**
   * 🔴 LA CANCELLAZIONE DELL'ACCOUNT STA QUI PERCHÉ QUI LA SI CERCA.
   *
   * Fino al 09/09/2026 esisteva solo dentro la modale «Modifica profilo» della
   * scheda atleta: c'era, funzionava, e nessuno l'avrebbe trovata. La linea
   * guida 5.1.1(v) di App Store non chiede che esista, chiede che sia «easy to
   * find» — e il posto in cui un revisore la cerca sono le Impostazioni, sopra
   * «Esci dall'account».
   *
   * ⚠️ Si mostra a TUTTI i ruoli, coach compreso. Nasconderla a chi è in
   * ADMIN_EMAILS vorrebbe dire nasconderla a `demo@fleofit.it`, cioè
   * esattamente all'account con cui il revisore entra.
   *
   * ⚠️ Riaccedere entro i 7 giorni NON annulla niente: `ProtectedRoute` non
   * filtra `deleted_at`, quindi si rientra e la riga resta comunque marcata.
   * Il solo modo di tornare indietro è Atleti → «Eliminati di recente», che ce
   * l'ha il coach — ed è per questo che il messaggio dice quello e non «puoi
   * annullare riaccedendo», che sarebbe falso.
   */
  const eliminaAccount = () => {
    setConfirmInfo({
      title: 'Eliminare il tuo account?',
      message: 'Il profilo e tutto il tuo storico — allenamenti, note e record — verranno eliminati definitivamente fra 7 giorni. Entro quel termine solo il coach può annullare l\'operazione.',
      onConfirm: async () => {
        setConfirmInfo(null)
        setOperazione('eliminaAccount')
        const { error } = await supabase.from('athletes')
          .update({ deleted_at: Date.now() }).eq('id', user.id)
        setOperazione(null)
        if (error) {
          setAlertInfo({ title: 'Errore', message: "Eliminazione non riuscita: " + error.message, type: 'error' })
          return
        }
        await supabase.auth.signOut()
        navigate('/login')
      }
    })
  }

  /**
   * Ritirare il consenso (GDPR art. 7.3: facile quanto darlo). Senza consenso
   * nell'app non si entra, quindi si esce: al prossimo accesso `ProtectedRoute`
   * ripropone la schermata. I dati restano — per cancellarli c'è «Elimina il
   * mio account», ed è il messaggio a dirlo.
   */
  const ritiraConsenso = () => {
    setConfirmInfo({
      title: 'Ritirare il consenso?',
      message: 'Senza consenso non puoi usare FLEOFIT: uscirai dall\'account, e al prossimo accesso ti verrà chiesto di nuovo. I tuoi dati restano finché non elimini l\'account.',
      onConfirm: async () => {
        setConfirmInfo(null)
        setOperazione('consenso')
        const { error } = await supabase.auth.updateUser({ data: { consenso: null } })
        setOperazione(null)
        if (error) {
          setAlertInfo({ title: 'Errore', message: 'Non siamo riusciti a ritirare il consenso: ' + error.message, type: 'error' })
          return
        }
        await supabase.auth.signOut()
        navigate('/login')
      }
    })
  }

  /**
   * «Collega»: `garmin-auth` / `inizia` prepara il PKCE lato server e risponde
   * con l'indirizzo di Garmin. Sul nativo si apre nel browser in-app (il ritorno
   * è il deep link `fleofit://garmin`), sul web nella stessa scheda.
   */
  const collegaGarmin = async () => {
    setOperazione('garmin')
    try {
      const { data, error } = await supabase.functions.invoke('garmin-auth', {
        body: { azione: 'inizia', consenso: VERSIONE_CONSENSO_GARMIN, ritorno: ritornoGarmin() },
      })
      if (error) throw error
      // Senza indirizzo non c'è niente da aprire: lo si dice, come un errore.
      if (!data?.url) throw new Error('garmin-auth senza url')
      if (Capacitor.isNativePlatform()) await Browser.open({ url: data.url })
      else window.location.assign(data.url)
    } catch (e) {
      console.error('Collegamento Garmin non avviato:', e)
      setAlertInfo({ title: 'Garmin non collegato', message: 'Non siamo riusciti ad avviare il collegamento con Garmin: riprova fra qualche minuto.', type: 'error' })
    } finally {
      setOperazione(null)
    }
  }

  /** «Scollega»: il server avvisa Garmin e cancella i dati arrivati (policy, sezione 3). */
  const scollegaGarmin = () => {
    setConfirmInfo({
      title: 'Scollegare Garmin?',
      message: 'FLEOFIT smetterà di ricevere i dati del tuo Garmin e cancellerà quelli già arrivati. Puoi ricollegarlo quando vuoi.',
      confirmLabel: 'Sì, scollega',
      onConfirm: async () => {
        setConfirmInfo(null)
        setOperazione('garmin')
        const { error } = await supabase.functions.invoke('garmin-auth', { body: { azione: 'scollega' } })
          .catch(e => ({ error: e }))
        setOperazione(null)
        if (error) {
          console.error('Scollegamento Garmin non riuscito:', error)
          setAlertInfo({ title: 'Errore', message: 'Non siamo riusciti a scollegare Garmin: riprova fra qualche minuto.', type: 'error' })
          return
        }
        setFoglioGarminAperto(false)
        // Lo stato si scrive qui e non si rilegge: una rilettura fallita
        // (`disponibile: false`) farebbe sparire la riga appena scollegata.
        setGarmin({ disponibile: true, stato: null, dal: null, permessi: [] })
        setAlertInfo({ title: 'Garmin scollegato', message: 'Non riceviamo più i dati del tuo Garmin.', type: 'success' })
      }
    })
  }

  const handleEnableNotifications = async () => {
    if (Capacitor.isNativePlatform()) {
      setOperazione('notifiche')
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          setOperazione(null)
          setAlertInfo({ title: 'Permesso negato', message: 'Devi autorizzare le notifiche dalle impostazioni di iOS.', type: 'error' });
          return;
        }

        await PushNotifications.removeAllListeners();

        PushNotifications.addListener('registration', async (token) => {
          let deviceToken = token.value;
          try {
             const fcmRes = await FCM.getToken();
             if (fcmRes.token) deviceToken = fcmRes.token;
          } catch (e) {
             // Senza token FCM si ripiega sul token APNs grezzo, che viene però
             // salvato con auth: 'capacitor_ios' e quindi trattato da
             // send-reminders come se fosse FCM: la push non arriverà mai.
             // È il guasto silenzioso descritto in CLAUDE.md, va visto nei log.
             console.error('FCM.getToken fallito, resta il token APNs grezzo:', e)
          }

          const { error } = await supabase.from('push_subscriptions').upsert({ 
            user_id: user.id, 
            endpoint: deviceToken, 
            auth: 'capacitor_ios', 
            p256dh: 'capacitor_ios' 
          }, { onConflict: 'endpoint' });
          
          setOperazione(null)
          if (error) setAlertInfo({ title: 'Errore DB', message: error.message, type: 'error' });
          else {
            setNotificationsEnabled(true)
            setAlertInfo({ title: 'Successo', message: 'Notifiche push native abilitate!', type: 'success' });
          }
        });

        PushNotifications.addListener('registrationError', (error) => {
          setOperazione(null)
          setAlertInfo({ title: 'Errore', message: 'Errore di registrazione ad APNs: ' + error.error, type: 'error' });
        });

        await PushNotifications.register();
      } catch (err) {
        setOperazione(null)
        setAlertInfo({ title: 'Errore', message: err.message, type: 'error' });
      }
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setAlertInfo({ title: 'Non supportato', message: 'Il tuo browser/dispositivo non supporta le notifiche push. Su iPhone ricordati di aggiungere l\'app alla schermata Home.', type: 'error' });
      return;
    }

    try {
      setOperazione('notifiche')
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setOperazione(null)
        setAlertInfo({ title: 'Permesso negato', message: 'Hai negato il permesso per le notifiche. Sbloccalo dalle impostazioni del browser.', type: 'error' });
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // ==============================================================
      // INSERISCI QUI LA PUBLIC KEY GENERATA CON npx web-push
      // ==============================================================
      const publicVapidKey = 'BFgnButtc-yZHbR6KCXV4khQDQkVRYUmVDekW5aeqQ-LEVFYBlYtGXvjLA7U0ObA9OqaX8Os5cDkEfZFpfsr-MQ'; 
      
      const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
        return outputArray;
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });

      const subData = JSON.parse(JSON.stringify(subscription));
      const { error } = await supabase.from('push_subscriptions').upsert({ user_id: user.id, endpoint: subData.endpoint, auth: subData.keys.auth, p256dh: subData.keys.p256dh }, { onConflict: 'endpoint' });
      
      setOperazione(null)
      if (error) throw error;
      setNotificationsEnabled(true)
      setAlertInfo({ title: 'Successo', message: 'Notifiche push abilitate con successo su questo dispositivo!', type: 'success' });
    } catch (err) {
      setOperazione(null)
      setAlertInfo({ title: 'Errore', message: err.message, type: 'error' });
    }
  }

  const handleDisableNotifications = async () => {
    setConfirmInfo({
      title: "Disabilita Notifiche",
      message: "Sei sicuro di voler disabilitare le notifiche su questo dispositivo?",
      onConfirm: async () => {
        setConfirmInfo(null)
        setOperazione('notifiche')
        try {
          if (Capacitor.isNativePlatform()) {
             await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('auth', 'capacitor_ios')
             await PushNotifications.removeAllListeners()
             setNotificationsEnabled(false)
             setAlertInfo({ title: 'Successo', message: 'Notifiche native disabilitate con successo.', type: 'success' })
          } else {
            const registration = await navigator.serviceWorker.getRegistration()
            if (registration) {
              const subscription = await registration.pushManager.getSubscription()
              if (subscription) {
                const subData = JSON.parse(JSON.stringify(subscription));
                await supabase.from('push_subscriptions').delete().eq('endpoint', subData.endpoint)
                await subscription.unsubscribe()
              }
            }
            setNotificationsEnabled(false)
            setAlertInfo({ title: 'Successo', message: 'Notifiche disabilitate con successo.', type: 'success' })
          }
        } catch (e) {
          setAlertInfo({ title: 'Errore', message: e.message, type: 'error' })
        }
        setOperazione(null)
      }
    })
  }

  const testMorningReminder = async () => {
    setOperazione('testMattina')
    await supabase.functions.invoke('send-reminders', { body: { mode: 'morning' } })
    setOperazione(null)
  }
  const testEveningReminder = async () => {
    setOperazione('testSera')
    await supabase.functions.invoke('send-reminders', { body: { mode: 'evening' } })
    setOperazione(null)
  }

  /**
   * L'interruttore delle notifiche. I due percorsi esistevano già: quello che
   * non esisteva era un comando che dicesse dov'è, invece di dire dove andrà.
   */
  const toggleNotifiche = () => {
    if (loading) return
    if (notificationsEnabled) handleDisableNotifications()
    else handleEnableNotifications()
  }

  // ── Segnala un problema ─────────────────────────────────────────────────

  /**
   * Spedisce con la Edge Function `segnalazione`, che verifica l'utente dal
   * JWT e manda la mail al coach (nessuna tabella: regola 0-bis). Un errore
   * detto dal server (`data.error`, es. il limite orario) arriva com'è a chi
   * scrive; uno di rete senza parole diventa un messaggio che dice cosa fare.
   */
  const inviaSegnalazione = async (corpo) => {
    const { data, error } = await supabase.functions.invoke('segnalazione', { body: corpo })
    if (data?.error) throw new Error(data.error)
    if (error) {
      console.error('Segnalazione non inviata:', error)
      // ⚠️ Su un non-2xx (400, 429, 502) supabase-js lascia `data` vuoto e mette
      // la Response in `error.context`: il messaggio del server sta lì dentro.
      let messaggio = null
      try { messaggio = (await error.context?.json?.())?.error } catch { /* resta il generico */ }
      throw new Error(messaggio || 'Invio non riuscito. Riprova tra poco.')
    }
  }

  /** Calcolati mentre il foglio è aperto, non al montaggio: la rete e la coda cambiano. */
  const tecniciSegnalazione = () => datiTecnici({
    versione,
    piattaforma: Capacitor.getPlatform(),
    userAgent: navigator.userAgent,
    ruolo: etichettaRuolo(role, { anteprimaAtleta: isSimulatingAthlete }),
    online: navigator.onLine,
    inCoda: leggiCoda().length,
    ora: new Date(),
    lingua: navigator.language,
    fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  // ── I codici invito ─────────────────────────────────────────────────────

  const generaCodice = async () => {
    setOperazione('codice')
    const nuovo = [...Array(8)].map(() => Math.random().toString(36)[2]).join('').toUpperCase()
    const { error } = await supabase.from('invitation_codes').insert({ code: nuovo, created_by: user.id })
    if (error) setAlertInfo({ title: 'Errore', message: 'Errore nella generazione del codice: ' + error.message, type: 'error' })
    else await caricaCodici()
    setOperazione(null)
  }

  const copiaTesto = async (testo, tipo) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(testo)
      } else {
        // Ripiego per i WebView senza Clipboard API: senza, «Copia» non fa
        // niente e non lo dice.
        const area = document.createElement('textarea')
        area.value = testo
        area.style.position = 'fixed'
        document.body.appendChild(area)
        area.focus(); area.select()
        document.execCommand('copy')
        document.body.removeChild(area)
      }
      setAlertInfo({ title: 'Copiato!', message: `${tipo} copiato negli appunti.`, type: 'success' })
    } catch {
      setAlertInfo({ title: 'Errore', message: 'Impossibile copiare il testo.', type: 'error' })
    }
  }

  /**
   * Lo staff con account e nome arriva da `elenco_staff()` (il client non legge
   * auth.users). Prima della migrazione multi-coach la funzione non c'è: il
   * foglio lo dice e il resto della pagina non cambia.
   */
  const caricaStaff = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('elenco_staff')
      if (error || !Array.isArray(data)) throw error || new Error('elenco_staff vuoto')
      // Se coach_atleti non si legge i numeri non si sanno: `null`, e il foglio
      // scrive «—». Mai 0: «0 atleti» direbbe che si può togliere il coach.
      const { data: coppie, error: erroreCoppie } = await supabase.from('coach_atleti').select('coach_id')
      if (erroreCoppie || !Array.isArray(coppie)) {
        if (erroreCoppie) console.error('Atleti dei coach non letti:', erroreCoppie)
        setConteggiCoach(null)
      } else {
        const conteggi = {}
        for (const c of coppie) conteggi[c.coach_id] = (conteggi[c.coach_id] || 0) + 1
        setConteggiCoach(conteggi)
      }
      setStaff(data)
      setErroreStaff(null)
    } catch (e) {
      console.error('Elenco staff non letto:', e)
      setErroreStaff('La gestione dei coach sarà disponibile dopo l\'aggiornamento del database')
    }
  }, [])

  const apriGestioneCoach = () => { setFoglioCoachAperto(true); caricaStaff() }

  const aggiungiUnCoach = async (email) => {
    if (!normalizzaEmail(email)) {
      return setAlertInfo({ title: 'Indirizzo non valido', message: 'Scrivi un indirizzo email completo.', type: 'error' })
    }
    setOccupatoCoach(true)
    const { error } = await aggiungiCoach(supabase, email)
    setOccupatoCoach(false)
    if (error) {
      const doppio = error?.code === '23505'
      return setAlertInfo({ title: 'Coach non aggiunto', message: doppio ? 'Questo indirizzo è già nello staff.' : (error.message || String(error)), type: 'error' })
    }
    caricaStaff()
  }

  const toglieUnCoach = (membro, atleti) => {
    if (atleti > 0) {
      return setAlertInfo({ title: 'Ha ancora atleti', message: 'Prima sposta i suoi atleti a un altro coach dalla loro scheda.', type: 'error' })
    }
    setConfirmInfo({
      title: 'Togliere il coach?',
      message: `${membro.nome || membro.email} non potrà più accedere come coach.`,
      onConfirm: async () => {
        setOccupatoCoach(true)
        const { error } = await togliCoach(supabase, membro.email, membro.user_id)
        setOccupatoCoach(false)
        if (error) {
          return setAlertInfo({ title: 'Coach non tolto', message: typeof error === 'string' ? error : (error.message || String(error)), type: 'error' })
        }
        caricaStaff()
      },
    })
  }

  const eliminaCodice = (codice) => {
    setConfirmInfo({
      title: 'Elimina codice',
      message: 'Sei sicuro di voler eliminare definitivamente questo codice?',
      onConfirm: async () => {
        setConfirmInfo(null)
        const { error } = await supabase.from('invitation_codes').delete().eq('id', codice.id)
        if (error) setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
        await caricaCodici()
      }
    })
  }


  // I pezzi della pagina, scritti una volta: il telefono li impila nell'ordine
  // di sempre, il desktop mette a destra gli strumenti del coach.
  // ⚠️ Una sezione nuova va in ENTRAMBE le disposizioni.
  const pCarta = (
    <>
      {/* ── L'eroe: con quale account sei dentro, e cosa è acceso qui ────── */}
      <CartaAccount
        nome={nome || user?.email?.split('@')[0] || 'Il tuo profilo'}
        email={user?.email}
        ruolo={etichettaRuolo(role, { anteprimaAtleta: isSimulatingAthlete })}
        etichettaDispositivo={Capacitor.isNativePlatform() ? 'Su questo iPhone' : 'Su questo dispositivo'}>

        <RigaInterruttore
          icona={notificationsEnabled ? BellRing : Bell} tono="brand"
          titolo="Notifiche push"
          dettaglio={notificationsEnabled ? 'Promemoria mattina e sera · attive' : 'Spente su questo dispositivo'}
          attivo={notificationsEnabled} onCambia={toggleNotifiche}
          occupato={operazione === 'notifiche'} />

      </CartaAccount>
    </>
  )
  const pAccount = (
    <>
      {/* ── Account ──────────────────────────────────────────────────────── */}
      <Sezione etichetta="Account">
        <RigaAzione icona={KeyRound}
          titolo={primaPassword ? 'Password per il sito' : 'Modifica password'}
          dettaglio={primaPassword ? 'Per entrare anche dal computer, con email e password' : 'Aggiorna la password di accesso'}
          onClick={() => setPasswordModalOpen(true)} />

        {adminReale && (
          <>
            <Separatore />
            {/* Un interruttore e non un bottone: è uno stato del dispositivo,
                e il testo non deve più cambiare da «Anteprima come atleta» a
                «Torna alla vista Coach» per dire dove ti trovi. */}
            <RigaInterruttore
              icona={isSimulatingAthlete ? EyeOff : Eye} tono="azzurro"
              titolo="Anteprima come atleta"
              dettaglio="Cambia solo la navigazione. Non sblocca nulla."
              attivo={isSimulatingAthlete} onCambia={toggleSimulateAthlete} />
          </>
        )}
      </Sezione>
    </>
  )
  const pCoach = (
    <>
      {/* ── Solo coach ───────────────────────────────────────────────────── */}
      {eStaff(role) && (
        <>
          <Sezione etichetta="Solo coach">
            {/* Per un coach la lista porta solo i suoi codici: lo decide la RLS. */}
            <RigaAzione icona={Ticket} tono="brand" titolo="Codici invito"
              dettaglio={riassuntoCodici(codici) || 'Genera e condividi gli inviti'}
              onClick={() => setFoglioCodiciAperto(true)} />
            {eAdmin(role) && (<>
            <Separatore />
            <RigaAzione icona={Users} titolo="Coach"
              dettaglio="Chi lavora nell'app e di chi sono gli atleti"
              onClick={apriGestioneCoach} />
            </>)}
          </Sezione>

          {/* I test delle push non sono impostazioni: sono strumenti, e sono
              gli unici due comandi della pagina che spediscono qualcosa a
              tutti gli atleti. Stanno in fondo, chiusi, insieme a export e
              import del backup atleta. «Ripristina database totale» è stato
              tolto il 27/10/2026 (richiesta del committente): il backup
              notturno resta la via di ritorno. */}
          {eAdmin(role) && (
          <Sezione>
            <RigaPieghevole piccola icona={Wrench} titolo="Strumenti sviluppo"
              aperto={sviluppoAperto} onToggle={() => setSviluppoAperto(v => !v)}>
              {/* -mx-3.5: le righe hanno già il loro margine, il pieghevole il suo. */}
              <div className="-mx-3.5 mb-3">
                <RigaAzione icona={HardDriveDownload} titolo="Esporta database"
                  dettaglio={riassuntoBackup({ ultimoExport, atleti: conteggi.atleti, workout: conteggi.workout })}
                  onClick={handleExportFull} occupato={operazione === 'export'} />
                <Separatore />
                <RigaAzione icona={UserCheck} tono="verde" titolo="Importa backup atleta"
                  dettaglio="Un solo profilo da file .json. L'esportazione si fa dalla sua scheda."
                  onClick={() => athleteImportRef.current?.click()}
                  occupato={operazione === 'importAtleta'} />
              </div>
              <div className="flex gap-2.5">
                <button type="button" onClick={testMorningReminder} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-white/[.06] border border-white/[.1]
                             text-[13px] font-bold text-gray-200 hover:bg-white/[.1] transition disabled:opacity-50">
                  {operazione === 'testMattina' ? 'Invio…' : 'Test mattina'}
                </button>
                <button type="button" onClick={testEveningReminder} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-white/[.06] border border-white/[.1]
                             text-[13px] font-bold text-gray-200 hover:bg-white/[.1] transition disabled:opacity-50">
                  {operazione === 'testSera' ? 'Invio…' : 'Test sera'}
                </button>
              </div>
            </RigaPieghevole>
          </Sezione>
          )}
        </>
      )}
    </>
  )
  const pAiuto = (
    <>
      {/* ── Aiuto ──────────────────────────────────────────────────────────
          Per TUTTI i ruoli: chi trova i problemi è soprattutto l'atleta. */}
      <Sezione etichetta="Aiuto">
        <RigaAzione icona={LifeBuoy} titolo="Segnala un problema"
          dettaglio="Un problema o un'idea per l'app"
          onClick={() => setFoglioSegnalazioneAperto(true)} />
      </Sezione>
    </>
  )
  const quandoConsenso = atletaVero ? dataConsenso(user) : null
  const dettaglioGarmin = garmin.stato === 'attivo'
    ? (dataCollegamento(garmin.dal) ? `Collegato · dal ${dataCollegamento(garmin.dal)}` : 'Collegato')
    : garmin.stato === 'da_ricollegare' ? 'Da ricollegare' : 'Non collegato'
  const pPrivacy = (
    <>
      {/* ── Dispositivi: solo l'atleta vero, e solo se `stato_garmin` esiste ── */}
      {atletaVero && garmin.disponibile && (
        <Sezione etichetta="Dispositivi">
          <RigaAzione icona={Watch} titolo="Garmin Connect" dettaglio={dettaglioGarmin}
            onClick={() => setFoglioGarminAperto(true)} occupato={operazione === 'garmin'} />
        </Sezione>
      )}
      <Sezione etichetta="Privacy">
        <RigaAzione icona={ShieldCheck} titolo="Informativa privacy"
          dettaglio={quandoConsenso ? `Consenso dato il ${quandoConsenso}` : 'Come trattiamo i dati'}
          onClick={apriInformativa} />
        {atletaVero && (<>
          <Separatore />
          <RigaAzione icona={ShieldOff} titolo="Ritira il consenso"
            dettaglio="Senza consenso non puoi usare FLEOFIT"
            onClick={ritiraConsenso} occupato={operazione === 'consenso'} />
        </>)}
      </Sezione>
    </>
  )
  const pElimina = (
    <>
      {/* Fuori da ogni gruppo e sopra l'uscita: è l'ultimo gesto della
          pagina, ed è l'unico irreversibile che riguarda chi lo compie. */}
      <RigaPericolo icona={Trash2} titolo="Elimina il mio account"
        dettaglio="Rimuove il profilo e tutto il tuo storico"
        onClick={eliminaAccount} occupato={operazione === 'eliminaAccount'} />
    </>
  )
  const pUscita = (
    <>
      <BottoneEsci onClick={handleLogout} />
      <PiediPagina versione={versione} email={user?.email} />
    </>
  )

  return (
    /* ⚠️ Niente `page-transition`: la pagina non sale più tutta insieme.
       `cascata` fa entrare i suoi figli uno dopo l'altro (src/index.css). */
    <div className={`${desktop ? 'px-8 max-w-[1100px]' : 'px-4 max-w-2xl'} mx-auto pb-[var(--fondo-pagina)] pt-[calc(env(safe-area-inset-top)+1rem)]
                    flex flex-col gap-3.5 cascata`}>

      <TestataImpostazioni onIndietro={desktop ? null : indietro} />

      {desktop && eStaff(role) ? (
        // Desktop: a sinistra chi sei e il tuo account, a destra gli strumenti
        // del coach (inviti, backup, ripristino), che sono il grosso del lavoro
        // da scrivania. Solo `admin` li ha: per gli altri la colonna è una.
        <div data-disposizione="desktop" className="grid grid-cols-12 gap-6 items-start">
          <div data-colonna="sinistra" className="col-span-5 flex flex-col gap-3.5">
            {/* «Profilo» esiste solo qui: allinea la carta dell'account a
                quella di «Solo coach», che ha la sua etichetta sopra. */}
            <section aria-label="Profilo">
              <EtichettaSezione>Profilo</EtichettaSezione>
              {pCarta}
            </section>
            {pAccount}{pAiuto}{pPrivacy}{pElimina}{pUscita}
          </div>
          <div data-colonna="destra" className="col-span-7 flex flex-col gap-3.5">
            {pCoach}
          </div>
        </div>
      ) : (
        <>
          {pCarta}{pAccount}{pCoach}{pAiuto}{pPrivacy}{pElimina}{pUscita}
        </>
      )}

      <input type="file" accept=".json" className="hidden" ref={athleteImportRef} onChange={handleImportAthlete} />

      {foglioCodiciAperto && (
        <FoglioCodici
          onChiudi={() => setFoglioCodiciAperto(false)}
          codici={codici} caricamento={codiciInCaricamento} generando={operazione === 'codice'}
          onGenera={generaCodice}
          onCopia={(c) => copiaTesto(c.code, 'Codice')}
          onCopiaLink={(c) => {
            const base = Capacitor.isNativePlatform() ? 'https://fleofit.vercel.app' : window.location.origin
            copiaTesto(`${base}/?invite=${c.code}`, 'Link')
          }}
          onElimina={eliminaCodice} />
      )}

      {foglioCoachAperto && eAdmin(role) && (
        <FoglioGestioneCoach
          staff={staff} conteggi={conteggiCoach} errore={erroreStaff} occupato={occupatoCoach}
          onAggiungi={aggiungiUnCoach} onTogli={toglieUnCoach}
          onChiudi={() => setFoglioCoachAperto(false)} />
      )}

      {foglioSegnalazioneAperto && (
        <FoglioSegnalazione
          onChiudi={() => setFoglioSegnalazioneAperto(false)}
          onInvia={inviaSegnalazione}
          tecnici={tecniciSegnalazione()}
          notificheSpente={!notificationsEnabled}
          onAttivaNotifiche={toggleNotifiche} />
      )}

      {foglioGarminAperto && atletaVero && garmin.disponibile && (
        <FoglioGarmin
          stato={garmin.stato} dal={garmin.dal} permessi={garmin.permessi}
          occupato={operazione === 'garmin'}
          onCollega={collegaGarmin} onScollega={scollegaGarmin} onInformativa={apriInformativa}
          onChiudi={() => setFoglioGarminAperto(false)} />
      )}

      {passwordModalOpen && createPortal(
        <PasswordModal
          onClose={() => setPasswordModalOpen(false)}
          user={user}
          primaPassword={primaPassword}
          setAlertInfo={setAlertInfo}
        />,
        document.body
      )}

      {createPortal(
        <>
          <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />
          <CustomConfirm info={confirmInfo} onClose={() => setConfirmInfo(null)} />
        </>,
        document.body
      )}
    </div>
  )
}

/** «14 ago 2026, 09:12» — una `used_at` illeggibile non porta via il foglio. */
function dataRiscatto(iso) {
  if (!iso) return null
  try {
    return format(parseISO(iso), 'd MMM yyyy, HH:mm', { locale: it })
  } catch {
    return null
  }
}
/**
 * Il foglio della password, in due modi.
 *
 * - **Modifica**: chi ha già una password conferma quella attuale.
 * - **Prima password** (`primaPassword`): chi è entrato con Apple o Google non
 *   ne ha una, e Sign in with Apple sul sito non c'è. Qui la sceglie, e vede
 *   l'indirizzo con cui entrare dal computer — con «Nascondi la mia email» è un
 *   `…@privaterelay.appleid.com` che nessuno ricorda, per questo si copia.
 */
function PasswordModal({ onClose, user, primaPassword = false, setAlertInfo }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiato, setCopiato] = useState(false)

  const copiaEmail = async () => {
    try {
      await navigator.clipboard.writeText(user?.email || '')
      setCopiato(true)
    } catch {
      // Senza appunti l'indirizzo resta lì, in un campo selezionabile.
    }
  }

  const handleUpdate = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!primaPassword && !currentPassword) return setAlertInfo({ title: 'Errore', message: 'Inserisci la password attuale.', type: 'error' })
    if (!newPassword || newPassword.length < 6) return setAlertInfo({ title: 'Errore', message: 'La nuova password deve avere almeno 6 caratteri.', type: 'error' })
    
    setSaving(true)

    if (!primaPassword) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })

      if (signInError) {
        setSaving(false)
        return setAlertInfo({ title: 'Errore', message: 'La password attuale non è corretta.', type: 'error' })
      }
    }
    
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    
    setSaving(false)
    if (updateError) {
      // ⚠️ Con «Secure password change» attivo su Supabase, una sessione più
      // vecchia di 24 ore deve riconfermarsi con un codice via email — che a
      // un indirizzo nascosto da Apple può non arrivare. Rientrare con Apple
      // fa una sessione nuova, ed è la strada che funziona sempre.
      const vecchia = updateError.code === 'reauthentication_needed' || /reauthenticat/i.test(updateError.message || '')
      setAlertInfo({
        title: 'Errore',
        message: vecchia ? 'Per sicurezza esci dall\'account, rientra e riprova subito.' : updateError.message,
        type: 'error',
      })
    } else if (primaPassword) {
      setAlertInfo({ title: 'Password salvata', message: `Dal computer entra con ${user?.email} e questa password.`, type: 'success' })
      onClose()
    } else {
      setAlertInfo({ title: 'Successo', message: 'Password aggiornata con successo!', type: 'success' })
      onClose()
    }
  }

  const campo = 'w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand text-base'

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 velo-in">
      <div className={`${CARD} w-full max-w-sm flex flex-col modal-transition`}>
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">{primaPassword ? 'Password per il sito' : 'Modifica Password'}</p>
          <button aria-label="Chiudi" type="button" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4" onKeyDown={e => { if (e.key === 'Enter') handleUpdate(e) }}>
          {primaPassword ? (
            <>
              <p className="text-gray-400 text-sm leading-snug">
                Sul sito non si entra con Apple. Scegli una password: dal computer entrerai con questo indirizzo e la password.
              </p>
              <div>
                <label className="text-gray-400 text-xs pl-1 mb-1 block">La tua email di accesso</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={user?.email || ''} aria-label="La tua email di accesso"
                    onFocus={e => e.target.select()} className={`${campo} min-w-0 text-sm`} />
                  <button type="button" onClick={copiaEmail}
                    className="shrink-0 px-4 rounded-xl bg-[#2a2a2a] text-white text-sm font-bold hover:brightness-110 transition">
                    {copiato ? 'Copiata' : 'Copia'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="text-gray-400 text-xs pl-1 mb-1 block">Password attuale</label>
              <input type="password" placeholder="La tua password attuale" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={campo} />
            </div>
          )}
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">{primaPassword ? 'Password' : 'Nuova password'}</label>
            <input type="password" autoComplete="new-password" placeholder="Almeno 6 caratteri" aria-label={primaPassword ? 'Password' : 'Nuova password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={campo} />
          </div>
          <button type="button" onClick={handleUpdate} disabled={saving || (!primaPassword && !currentPassword) || !newPassword} className="w-full mt-2 py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
            {saving ? 'Salvataggio...' : (primaPassword ? 'Salva password' : 'Aggiorna Password')}
          </button>
        </div>
      </div>
    </div>
  )
}
