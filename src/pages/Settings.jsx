import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Database, UploadCloud, Download, UserCheck, HardDriveDownload, HardDriveUpload, LogOut, Eye, EyeOff, Plus, Copy, Link as LinkIcon, Trash2, ChevronDown, KeyRound, X, Bell, BellRing, Heart } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'
import { useAuth, ADMIN_EMAILS } from '../App'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { FCM } from '@capacitor-community/fcm'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { BluetoothService } from './bluetooth'

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)
  const fullImportRef = useRef(null)
  const athleteImportRef = useRef(null)
  const { role, user } = useAuth()
  const isAdminEmail = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isSimulatingAthlete = localStorage.getItem('adminRoleOverride') === 'athlete'
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [hrConnected, setHrConnected] = useState(false)
  const [heartRate, setHeartRate] = useState(null)

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

  useEffect(() => {
    return BluetoothService.subscribe((connected, hr) => {
      setHrConnected(connected)
      setHeartRate(hr)
    })
  }, [])

  const handleExportFull = async () => {
    setLoading(true)
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
    } catch (e) {
      setAlertInfo({ title: 'Errore', message: "Errore esportazione: " + e.message, type: 'error' })
    }
    setLoading(false)
  }

  const handleImportFull = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setConfirmInfo({
      title: "Attenzione",
      message: "Questa operazione caricherà l'intero database e sovrascriverà i dati esistenti. Vuoi procedere?",
      onConfirm: async () => {
        setLoading(true)
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
        setLoading(false)
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
    setLoading(true)
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
    setLoading(false)
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

  const handleEnableNotifications = async () => {
    if (Capacitor.isNativePlatform()) {
      setLoading(true)
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          setLoading(false)
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
             console.log("Errore recupero FCM token:", e);
          }

          const { error } = await supabase.from('push_subscriptions').upsert({ 
            user_id: user.id, 
            endpoint: deviceToken, 
            auth: 'capacitor_ios', 
            p256dh: 'capacitor_ios' 
          }, { onConflict: 'endpoint' });
          
          setLoading(false)
          if (error) setAlertInfo({ title: 'Errore DB', message: error.message, type: 'error' });
          else {
            setNotificationsEnabled(true)
            setAlertInfo({ title: 'Successo', message: 'Notifiche push native abilitate!', type: 'success' });
          }
        });

        PushNotifications.addListener('registrationError', (error) => {
          setLoading(false)
          setAlertInfo({ title: 'Errore', message: 'Errore di registrazione ad APNs: ' + error.error, type: 'error' });
        });

        await PushNotifications.register();
      } catch (err) {
        setLoading(false)
        setAlertInfo({ title: 'Errore', message: err.message, type: 'error' });
      }
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setAlertInfo({ title: 'Non supportato', message: 'Il tuo browser/dispositivo non supporta le notifiche push. Su iPhone ricordati di aggiungere l\'app alla schermata Home.', type: 'error' });
      return;
    }

    try {
      setLoading(true)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setLoading(false)
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
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
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
      
      setLoading(false)
      if (error) throw error;
      setNotificationsEnabled(true)
      setAlertInfo({ title: 'Successo', message: 'Notifiche push abilitate con successo su questo dispositivo!', type: 'success' });
    } catch (err) {
      setLoading(false)
      setAlertInfo({ title: 'Errore', message: err.message, type: 'error' });
    }
  }

  const handleDisableNotifications = async () => {
    setConfirmInfo({
      title: "Disabilita Notifiche",
      message: "Sei sicuro di voler disabilitare le notifiche su questo dispositivo?",
      onConfirm: async () => {
        setConfirmInfo(null)
        setLoading(true)
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
        setLoading(false)
      }
    })
  }

  const testMorningReminder = async () => {
    setLoading(true)
    await supabase.functions.invoke('send-reminders', { body: { mode: 'morning' } })
    setLoading(false)
  }
  const testEveningReminder = async () => {
    setLoading(true)
    await supabase.functions.invoke('send-reminders', { body: { mode: 'evening' } })
    setLoading(false)
  }

  const toggleHeartRate = async () => {
    try {
      if (hrConnected) {
        await BluetoothService.disconnect()
      } else {
        await BluetoothService.connect()
      }
    } catch (error) {
      const msg = error?.message || String(error);
      if (!msg.includes('cancelled') && !msg.includes('User cancelled')) {
        setAlertInfo({ title: 'Errore BLE', message: msg, type: 'error' })
      }
    }
  }

  return (
    <div className="px-4 max-w-2xl mx-auto pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] page-transition">
      <div className="mb-6 mt-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-[#1e1e1e] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-[#f1ba17] transition shadow-sm shrink-0">
          <ChevronLeft size={22} className="-ml-0.5" />
        </button>
        <h1 className="text-3xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Database size={24} className="text-[#f1ba17]" />
          Impostazioni
        </h1>
        <p className="text-gray-400 text-sm mt-1">Gestisci la tua app</p>
      </div>

      {loading && (
        <div className="mb-6 p-4 bg-[#f1ba17]/20 border border-[#f1ba17]/50 rounded-xl text-[#f1ba17] text-sm text-center animate-pulse font-medium">
          Operazione in corso, attendere prego...
        </div>
      )}

      {/* GESTIONE CODICI INVITO */}
      {role === 'admin' && <InviteCodeManager />}

      {/* SEZIONE NOTIFICHE PUSH */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 mt-6">
        <h2 className="text-lg font-bold text-white mb-4">Notifiche Push</h2>
        <p className="text-gray-400 text-sm mb-4">Ricevi promemoria per i tuoi allenamenti e avvisi quando il coach aggiorna la tua programmazione.</p>
        
        <button onClick={notificationsEnabled ? handleDisableNotifications : handleEnableNotifications} disabled={loading} className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] hover:border-[#f1ba17] transition disabled:opacity-50 group">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition shrink-0 ${notificationsEnabled ? 'bg-[#f1ba17]/10 text-[#f1ba17]' : 'bg-[#111] text-gray-400 group-hover:text-[#f1ba17]'}`}>
              {notificationsEnabled ? <BellRing size={20} /> : <Bell size={20} />}
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">{notificationsEnabled ? 'Disabilita Notifiche' : 'Abilita Notifiche'}</p>
              <p className="text-gray-500 text-xs">{notificationsEnabled ? 'Non riceverai più promemoria su questo dispositivo' : 'Attiva le notifiche su questo dispositivo'}</p>
            </div>
          </div>
        </button>

        {role === 'admin' && (
          <div className="flex gap-3 mt-3">
            <button onClick={testMorningReminder} disabled={loading} className="flex-1 p-3 rounded-xl bg-[#2a2a2a] border border-[#383838] hover:border-[#f1ba17] transition text-sm text-white font-semibold">
              Test Mattina
            </button>
            <button onClick={testEveningReminder} disabled={loading} className="flex-1 p-3 rounded-xl bg-[#2a2a2a] border border-[#383838] hover:border-[#f1ba17] transition text-sm text-white font-semibold">
              Test Sera
            </button>
          </div>
        )}
      </div>

      {/* SEZIONE FASCIA CARDIO */}
      {(role === 'athlete' || isSimulatingAthlete) && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 mt-6">
          <h2 className="text-lg font-bold text-white mb-4">Dispositivi e Sensori</h2>
          <p className="text-gray-400 text-sm mb-4">
            Collega direttamente la tua Fascia Cardio (Polar, Wahoo, Garmin HRM) o il tuo sportwatch. La connessione rimarrà attiva per tutto l'utilizzo dell'app.
            <br/><br/><span className="text-yellow-500 font-semibold">💡 Info:</span> Se usi una fascia cardio, <strong className="text-white">collegala direttamente all'app</strong> (puoi tenerla collegata in contemporanea anche all'orologio). Se usi un Garmin senza fascia, assicurati di attivare la funzione "Trasmetti FC" o "Broadcast Heart Rate" nelle impostazioni dell'orologio.
          </p>
          
          <button onClick={toggleHeartRate} disabled={loading} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition group ${hrConnected ? 'bg-red-500/10 border-red-500/30' : 'bg-[#2a2a2a] border-[#383838] hover:border-red-500'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition shrink-0 ${hrConnected ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-[#111] text-gray-400 group-hover:text-red-500'}`}>
                <Heart size={20} className={hrConnected && heartRate ? 'animate-pulse' : ''} fill={hrConnected ? 'currentColor' : 'none'} />
              </div>
              <div className="text-left">
                <p className={`font-semibold ${hrConnected ? 'text-red-500' : 'text-white'}`}>{hrConnected ? 'Cardiofrequenzimetro Connesso' : 'Connetti Fascia Cardio / Garmin'}</p>
                <p className={`text-xs ${hrConnected ? 'text-red-400' : 'text-gray-500'}`}>
                  {hrConnected ? (heartRate ? `${heartRate} BPM in tempo reale` : 'In attesa dei dati...') : 'Trasmetti via Bluetooth (BLE)'}
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

          {/* SEZIONE ACCOUNT */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 mt-6">
        <h2 className="text-lg font-bold text-white mb-4">Account</h2>
        
        <button onClick={() => setPasswordModalOpen(true)} className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] hover:border-[#f1ba17] transition group mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center group-hover:text-[#f1ba17] transition text-gray-400 shrink-0">
              <KeyRound size={20} />
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">Modifica Password</p>
              <p className="text-gray-500 text-xs">Aggiorna la tua password di accesso</p>
            </div>
          </div>
        </button>

        {isAdminEmail && (
          <button onClick={toggleSimulateAthlete} className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] hover:border-blue-500 transition group mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center group-hover:text-blue-500 transition text-gray-400 shrink-0">
                {isSimulatingAthlete ? <EyeOff size={20} /> : <Eye size={20} />}
              </div>
              <div className="text-left">
                <p className="text-white font-semibold">{isSimulatingAthlete ? 'Torna alla vista Admin' : 'Simula vista Atleta'}</p>
                <p className="text-gray-500 text-xs">{isSimulatingAthlete ? 'Ripristina tutti i controlli da Coach' : 'Vedi l\'app esattamente come un atleta'}</p>
              </div>
            </div>
          </button>
        )}

        <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] hover:border-red-500 transition group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center group-hover:text-red-500 transition text-gray-400 shrink-0">
              <LogOut size={20} />
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">Esci dall'account</p>
              <p className="text-gray-500 text-xs">Disconnettiti dall'app FLEOFIT</p>
            </div>
          </div>
        </button>
      </div>

      {/* SEZIONE BACKUP */}
      {role === 'admin' && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 mt-6">
          <h2 className="text-lg font-bold text-white mb-4">Backup e Ripristino</h2>
          <div className="flex flex-col gap-3">
            <button onClick={handleExportFull} disabled={loading} className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] hover:border-[#f1ba17] transition disabled:opacity-50 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center group-hover:text-[#f1ba17] transition text-gray-400 shrink-0">
                  <HardDriveDownload size={20} />
                </div>
                <div className="text-left">
                  <p className="text-white font-semibold">Esporta tutto il Database</p>
                  <p className="text-gray-500 text-xs">Scarica un file .json con tutti gli atleti e i workout</p>
                </div>
              </div>
              <Download size={18} className="text-gray-600 group-hover:text-[#f1ba17]" />
            </button>

            <button onClick={() => fullImportRef.current?.click()} disabled={loading} className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] hover:border-blue-500 transition disabled:opacity-50 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center group-hover:text-blue-500 transition text-gray-400 shrink-0">
                  <HardDriveUpload size={20} />
                </div>
                <div className="text-left">
                  <p className="text-white font-semibold">Ripristina Database Totale</p>
                  <p className="text-gray-500 text-xs">Carica un file .json di backup totale</p>
                </div>
              </div>
              <UploadCloud size={18} className="text-gray-600 group-hover:text-blue-500" />
            </button>
            <input type="file" accept=".json" className="hidden" ref={fullImportRef} onChange={handleImportFull} />
            
            <div className="w-full h-px bg-[#333] my-2"></div>

            <button onClick={() => athleteImportRef.current?.click()} disabled={loading} className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] hover:border-green-500 transition disabled:opacity-50 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center group-hover:text-green-500 transition text-gray-400 shrink-0">
                  <UserCheck size={20} />
                </div>
                <div className="text-left">
                  <p className="text-white font-semibold">Importa Backup Atleta</p>
                  <p className="text-gray-500 text-xs">L'esportazione si fa dal profilo del singolo atleta.</p>
                </div>
              </div>
              <UploadCloud size={18} className="text-gray-600 group-hover:text-green-500" />
            </button>
            <input type="file" accept=".json" className="hidden" ref={athleteImportRef} onChange={handleImportAthlete} />
          </div>
        </div>
      )}
      
      
      {passwordModalOpen && createPortal(
        <PasswordModal 
          onClose={() => { setPasswordModalOpen(false); setIsRecovery(false); }} 
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

function InviteCodeManager() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)
  const [showActive, setShowActive] = useState(true)
  const [showUsed, setShowUsed] = useState(false)
  const { user } = useAuth();

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    const { data: codesData, error } = await supabase
      .from('invitation_codes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    } else {
      // Estraiamo i nomi reali di chi ha riscattato il codice (se hanno completato il profilo)
      const usedByIds = codesData.filter(c => c.used_by).map(c => c.used_by);
      if (usedByIds.length > 0) {
        const { data: athletesData } = await supabase.from('athletes').select('id, name, surname').in('id', usedByIds);
        if (athletesData) {
          const athletesMap = {};
          athletesData.forEach(a => athletesMap[a.id] = `${a.name} ${a.surname}`);
          codesData.forEach(c => {
            if (c.used_by && athletesMap[c.used_by]) {
              c.used_by_name = athletesMap[c.used_by];
            }
          });
        }
      }
      setCodes(codesData);
    }
    setLoading(false);
  };

  const generateCode = async () => {
    const newCode = [...Array(8)].map(() => Math.random().toString(36)[2]).join('').toUpperCase();
    const { error } = await supabase
      .from('invitation_codes')
      .insert({ code: newCode, created_by: user.id });
    
    if (error) {
      setAlertInfo({ title: 'Errore', message: 'Errore nella generazione del codice: ' + error.message, type: 'error' })
    } else {
      fetchCodes();
    }
  };

  const copyToClipboard = (text, type) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setAlertInfo({ title: 'Copiato!', message: `${type} copiato negli appunti.`, type: 'success' })
      }).catch(() => {
        setAlertInfo({ title: 'Errore', message: 'Impossibile copiare il testo.', type: 'error' })
      })
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setAlertInfo({ title: 'Copiato!', message: `${type} copiato negli appunti.`, type: 'success' })
      } catch (err) {
        setAlertInfo({ title: 'Errore', message: 'Impossibile copiare il testo.', type: 'error' })
      }
      document.body.removeChild(textArea);
    }
  };

  const deleteCode = async (id) => {
    setConfirmInfo({
      title: "Elimina codice",
      message: "Sei sicuro di voler eliminare definitivamente questo codice?",
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase.from('invitation_codes').delete().eq('id', id);
        if (error) setAlertInfo({ title: 'Errore', message: error.message, type: 'error' });
        fetchCodes();
        setConfirmInfo(null);
      }
    });
  };

  const activeCodes = codes.filter(c => c.is_active);
  const usedCodes = codes.filter(c => !c.is_active && c.used_by);

  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">Gestione Codici Invito</h2>
        <button onClick={generateCode} className="flex items-center gap-1.5 bg-[#f1ba17] text-black text-sm font-semibold px-3 py-1.5 rounded-full hover:brightness-110 transition">
          <Plus size={16} /> Genera Nuovo
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {/* CODICI ATTIVI */}
        <div className="bg-[#111] border border-[#333] rounded-2xl overflow-hidden">
          <button onClick={() => setShowActive(!showActive)} className="w-full flex items-center justify-between p-4 hover:bg-[#222] transition">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">Codici Attivi</span>
              <span className="bg-[#f1ba17]/10 text-[#f1ba17] px-2 py-0.5 rounded-full text-xs font-bold">{activeCodes.length}</span>
            </div>
            <ChevronDown size={18} className={`text-gray-500 transition-transform duration-300 ${showActive ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`transition-all duration-300 ease-out overflow-hidden ${showActive ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-4 pt-0 flex flex-col gap-2 overflow-y-auto hide-scrollbar" style={{ maxHeight: '400px' }}>
              {loading ? <p className="text-gray-500 text-xs">Caricamento...</p> : activeCodes.length > 0 ? (
                activeCodes.map(code => (
                  <div key={code.id} className="bg-[#2a2a2a] p-3 rounded-xl flex items-center justify-between border border-[#383838]">
                    <span className="font-mono text-lg text-[#f1ba17] tracking-widest">{code.code}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => copyToClipboard(code.code, 'Codice')} title="Copia codice" className="p-2 text-gray-400 hover:text-white transition bg-[#111] rounded-lg border border-[#333]"><Copy size={16} /></button>
                      <button onClick={() => {
                        const baseUrl = Capacitor.isNativePlatform() ? 'https://fleofit.vercel.app' : window.location.origin;
                        copyToClipboard(`${baseUrl}/?invite=${code.code}`, 'Link');
                      }} title="Copia link" className="p-2 text-gray-400 hover:text-white transition bg-[#111] rounded-lg border border-[#333]"><LinkIcon size={16} /></button>
                      
                      <button onClick={() => deleteCode(code.id)} title="Elimina" className="p-2 text-gray-400 hover:text-red-500 transition bg-[#111] rounded-lg border border-[#333]"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))
              ) : <p className="text-gray-500 text-xs">Nessun codice attivo. Generane uno nuovo.</p>}
            </div>
          </div>
        </div>

        {/* CODICI UTILIZZATI */}
        <div className="bg-[#111] border border-[#333] rounded-2xl overflow-hidden">
          <button onClick={() => setShowUsed(!showUsed)} className="w-full flex items-center justify-between p-4 hover:bg-[#222] transition">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">Codici Utilizzati</span>
              <span className="bg-[#222] text-gray-400 border border-[#333] px-2 py-0.5 rounded-full text-xs font-bold">{usedCodes.length}</span>
            </div>
            <ChevronDown size={18} className={`text-gray-500 transition-transform duration-300 ${showUsed ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`transition-all duration-300 ease-out overflow-hidden ${showUsed ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-4 pt-0 flex flex-col gap-2 overflow-y-auto hide-scrollbar" style={{ maxHeight: '400px' }}>
              {loading ? <p className="text-gray-500 text-xs">Caricamento...</p> : usedCodes.length > 0 ? (
                usedCodes.map(code => (
                  <div key={code.id} className="bg-[#222] p-3 rounded-xl flex items-center gap-3 text-sm border border-[#333]">
                    <span className="font-mono text-gray-500 line-through shrink-0">{code.code}</span>
                    <div className="flex-1 text-right text-gray-400 pr-3 border-r border-[#444] min-w-0">
                      <p className="font-semibold text-gray-300 truncate">{code.used_by_name || code.used_by_email || 'Utente Sconosciuto'}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">{format(parseISO(code.used_at), 'd MMM yyyy, HH:mm', { locale: it })}</p>
                    </div>
                    <button onClick={() => deleteCode(code.id)} title="Elimina log" className="p-2 text-gray-500 hover:text-red-500 shrink-0 transition bg-[#111] rounded-lg border border-[#333]"><Trash2 size={16} /></button>
                  </div>
                ))
              ) : <p className="text-gray-500 text-xs">Nessun codice è stato ancora utilizzato.</p>}
            </div>
          </div>
        </div>
      </div>
      {alertInfo && createPortal(<CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />, document.body)}
      {confirmInfo && createPortal(<CustomConfirm info={confirmInfo} onClose={() => setConfirmInfo(null)} />, document.body)}
    </div>
  );
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
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4" onKeyDown={e => { if (e.key === 'Enter') handleUpdate(e) }}>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Password attuale</label>
            <input type="password" placeholder="La tua password attuale" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17] text-base" />
          </div>
          <div>
            <label className="text-gray-400 text-xs pl-1 mb-1 block">Nuova password</label>
            <input type="password" placeholder="Scegli una nuova password sicura" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#f1ba17] text-base" />
          </div>
          <button type="button" onClick={handleUpdate} disabled={saving || !currentPassword || !newPassword} className="w-full mt-2 py-3.5 bg-[#f1ba17] text-black font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Aggiorna Password'}
          </button>
        </div>
      </div>
    </div>
  )
}