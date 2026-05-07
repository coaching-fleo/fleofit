import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Database, UploadCloud, Download, UserCheck, HardDriveDownload, HardDriveUpload } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { format } from 'date-fns'
import { CustomAlert, CustomConfirm } from '../components/CustomModals'

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)
  const [confirmInfo, setConfirmInfo] = useState(null)
  const fullImportRef = useRef(null)
  const athleteImportRef = useRef(null)

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
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `FLEOFIT_Full_Backup_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`
      link.click()
      URL.revokeObjectURL(url)
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

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      <button onClick={() => navigate(-1)} className="flex items-center text-[#f1ba17] hover:brightness-110 mb-6 transition-all active:scale-95 active:opacity-70 font-semibold text-[17px]">
        <ChevronLeft size={26} strokeWidth={2.5} className="-ml-2 mr-0.5" /> Indietro
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Database size={24} className="text-[#f1ba17]" />
          Impostazioni Database
        </h1>
        <p className="text-gray-400 text-sm mt-1">Gestisci i backup di sicurezza della tua app</p>
      </div>

      {loading && (
        <div className="mb-6 p-4 bg-[#f1ba17]/20 border border-[#f1ba17]/50 rounded-xl text-[#f1ba17] text-sm text-center animate-pulse font-medium">
          Operazione in corso, attendere prego...
        </div>
      )}

      {/* SEZIONE TOTALE */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 mb-6">
        <h2 className="text-lg font-bold text-white mb-4">Backup Totale</h2>
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
        </div>
      </div>

      {/* SEZIONE ATLETA */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5">
        <h2 className="text-lg font-bold text-white mb-4">Gestione Singolo Atleta</h2>
        <p className="text-gray-500 text-sm mb-4">L'esportazione del singolo atleta si fa direttamente dal pulsante download nella pagina del suo Profilo.</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => athleteImportRef.current?.click()} disabled={loading} className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#2a2a2a] border border-[#383838] hover:border-green-500 transition disabled:opacity-50 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center group-hover:text-green-500 transition text-gray-400 shrink-0">
                <UserCheck size={20} />
              </div>
              <div className="text-left">
                <p className="text-white font-semibold">Importa Backup Atleta</p>
                <p className="text-gray-500 text-xs">Ripristina un atleta dal suo file .json dedicato</p>
              </div>
            </div>
            <UploadCloud size={18} className="text-gray-600 group-hover:text-green-500" />
          </button>
          <input type="file" accept=".json" className="hidden" ref={athleteImportRef} onChange={handleImportAthlete} />
        </div>
      </div>
      
      <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />
      <CustomConfirm info={confirmInfo} onClose={() => setConfirmInfo(null)} />
    </div>
  )
}