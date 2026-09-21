import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useIndietro } from '../useIndietro'
import { UserCheck, HardDriveDownload, Eye, EyeOff, KeyRound, X, Bell, BellRing, Ticket, Wrench, AlertTriangle, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import { useAuth, ADMIN_EMAILS } from '../App'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
import { FCM } from '@capacitor-community/fcm'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { CHIAVE_ULTIMO_EXPORT, etichettaRuolo, riassuntoBackup, riassuntoCodici } from '../lib/rigaImpostazioni'
import {
  BottoneEsci, CartaAccount, FoglioCodici, PiediPagina, RigaAzione, RigaInterruttore,
  RigaPericolo, RigaPieghevole, Separatore, Sezione, TestataImpostazioni,
} from '../components/ImpostazioniUI'

export default function Settings() {
  const navigate = useNavigate()
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
  const fullImportRef = useRef(null)
  const athleteImportRef = useRef(null)
  const { role, user, nome } = useAuth()
  const isAdminEmail = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isSimulatingAthlete = localStorage.getItem('adminRoleOverride') === 'athlete'
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  const [sviluppoAperto, setSviluppoAperto] = useState(false)
  const [foglioCodiciAperto, setFoglioCodiciAperto] = useState(false)
  const [codici, setCodici] = useState(null)
  // Parte già a `true` per il coach: la lista si chiede al montaggio, e
  // accenderlo dentro `caricaCodici` renderebbe quella funzione un setState
  // sincrono dentro un effetto (react-hooks/set-state-in-effect).
  const [codiciInCaricamento, setCodiciInCaricamento] = useState(role === 'admin')
  const [conteggi, setConteggi] = useState({ atleti: null, workout: null })
  const [ultimoExport, setUltimoExport] = useState(() => {
    try { return localStorage.getItem(CHIAVE_ULTIMO_EXPORT) } catch { return null }
  })
  const [versione, setVersione] = useState(null)

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
    if (role !== 'admin') return
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
    if (role === 'admin') caricaCodici()
  }, [role, caricaCodici])
  const handleExportFull = async () => {
    setOperazione('export')
    try {
      // Estraiamo tutti i dati (impostando un limite alto per sicurezza)
      const { data: athletes } = await supabase.from('athletes').select('*').limit(10000)
      const { data: workouts } = await supabase.from('workouts').select('*').limit(10000)
      const { data: athlete_workouts } = await supabase.from('athlete_workouts').select('*').limit(10000)
      
      const backup = {
        version: 1,
        type: 'full_backup',
        timestamp: new Date().toISOString(),
        athletes: athletes || [],
        workouts: workouts || [],
        athlete_workouts: athlete_workouts || []
      }

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

  const handleImportFull = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setConfirmInfo({
      title: "Attenzione",
      message: "Questa operazione caricherà l'intero database e sovrascriverà i dati esistenti. Vuoi procedere?",
      onConfirm: async () => {
        setOperazione('importTotale')
        try {
          const text = await file.text()
          const data = JSON.parse(text)
          if (data.type !== 'full_backup') throw new Error("File non valido per il ripristino totale.")
          
          if (data.athletes?.length) {
            const { error } = await supabase.from('athletes').upsert(data.athletes, { onConflict: 'id' })
            if (error) throw new Error("Errore atleti: " + error.message)
          }
          if (data.workouts?.length) {
            const { error } = await supabase.from('workouts').upsert(data.workouts, { onConflict: 'id' })
            if (error) throw new Error("Errore workouts: " + error.message)
          }
          if (data.athlete_workouts?.length) {
            const { error } = await supabase.from('athlete_workouts').upsert(data.athlete_workouts, { onConflict: 'id' })
            if (error) throw new Error("Errore assegnazioni: " + error.message)
          }
          
          setAlertInfo({ title: 'Completato', message: "Ripristino totale completato con successo!", type: 'success' })
        } catch (err) {
          setAlertInfo({ title: 'Errore', message: "Errore importazione: " + err.message, type: 'error' })
        }
        setOperazione(null)
        if (fullImportRef.current) fullImportRef.current.value = ''
      },
      onCancel: () => {
        if (fullImportRef.current) fullImportRef.current.value = ''
      }
    })
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


  return (
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)] pt-[calc(env(safe-area-inset-top)+1rem)]
                    page-transition flex flex-col gap-3.5">

      <TestataImpostazioni onIndietro={indietro} />

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

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <Sezione etichetta="Account">
        <RigaAzione icona={KeyRound} titolo="Modifica password"
          dettaglio="Aggiorna la password di accesso"
          onClick={() => setPasswordModalOpen(true)} />

        {isAdminEmail && (
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

      {/* ── Solo coach ───────────────────────────────────────────────────── */}
      {role === 'admin' && (
        <>
          <Sezione etichetta="Solo coach">
            <RigaAzione icona={Ticket} tono="brand" titolo="Codici invito"
              dettaglio={riassuntoCodici(codici) || 'Genera e condividi gli inviti'}
              onClick={() => setFoglioCodiciAperto(true)} />
            <Separatore />
            <RigaAzione icona={HardDriveDownload} titolo="Esporta database"
              dettaglio={riassuntoBackup({ ultimoExport, atleti: conteggi.atleti, workout: conteggi.workout })}
              onClick={handleExportFull} occupato={operazione === 'export'} />
            <Separatore />
            <RigaAzione icona={UserCheck} tono="verde" titolo="Importa backup atleta"
              dettaglio="Un solo profilo da file .json. L'esportazione si fa dalla sua scheda."
              onClick={() => athleteImportRef.current?.click()}
              occupato={operazione === 'importAtleta'} />
          </Sezione>

          {/* Fuori dal gruppo, rosso, e con la sua cornice: prima aveva lo
              stesso aspetto di «Esporta», cioè due righe grigie identiche di
              cui una può cancellare il lavoro di un anno. */}
          <RigaPericolo icona={AlertTriangle} titolo="Ripristina database totale"
            dettaglio="Sovrascrive tutti i dati esistenti"
            onClick={() => fullImportRef.current?.click()}
            occupato={operazione === 'importTotale'} />

          {/* I test delle push non sono impostazioni: sono strumenti, e sono
              gli unici due comandi della pagina che spediscono qualcosa a
              tutti gli atleti. Stanno in fondo, chiusi. */}
          <Sezione>
            <RigaPieghevole piccola icona={Wrench} titolo="Strumenti sviluppo"
              aperto={sviluppoAperto} onToggle={() => setSviluppoAperto(v => !v)}>
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
        </>
      )}

      {/* Fuori da ogni gruppo e sopra l'uscita: è l'ultimo gesto della
          pagina, ed è l'unico irreversibile che riguarda chi lo compie. */}
      <RigaPericolo icona={Trash2} titolo="Elimina il mio account"
        dettaglio="Rimuove il profilo e tutto il tuo storico"
        onClick={eliminaAccount} occupato={operazione === 'eliminaAccount'} />

      <BottoneEsci onClick={handleLogout} />
      <PiediPagina versione={versione} email={user?.email} />

      <input type="file" accept=".json" className="hidden" ref={fullImportRef} onChange={handleImportFull} />
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

      {passwordModalOpen && createPortal(
        <PasswordModal
          onClose={() => setPasswordModalOpen(false)}
          user={user}
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
function PasswordModal({ onClose, user, setAlertInfo }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleUpdate = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!currentPassword) return setAlertInfo({ title: 'Errore', message: 'Inserisci la password attuale.', type: 'error' })
    if (!newPassword || newPassword.length < 6) return setAlertInfo({ title: 'Errore', message: 'La nuova password deve avere almeno 6 caratteri.', type: 'error' })
    
    setSaving(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    })
    
    if (signInError) {
      setSaving(false)
      return setAlertInfo({ title: 'Errore', message: 'La password attuale non è corretta.', type: 'error' })
    }
    
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    
    setSaving(false)
    if (updateError) {
      setAlertInfo({ title: 'Errore', message: updateError.message, type: 'error' })
    } else {
      setAlertInfo({ title: 'Successo', message: 'Password aggiornata con successo!', type: 'success' })
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm flex flex-col border border-[#333] shadow-2xl animate-in fade-in zoom-in-[0.96] duration-300 ease-out">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <p className="text-white font-bold text-lg">Modifica Password</p>
          <button aria-label="Chiudi" type="button" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4" onKeyDown={e => { if (e.key === 'Enter') handleUpdate(e) }}>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Password attuale</label>
            <input type="password" placeholder="La tua password attuale" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand text-base" />
          </div>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Nuova password</label>
            <input type="password" placeholder="Scegli una nuova password sicura" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-brand text-base" />
          </div>
          <button type="button" onClick={handleUpdate} disabled={saving || !currentPassword || !newPassword} className="w-full mt-2 py-3.5 bg-brand text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Aggiorna Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
