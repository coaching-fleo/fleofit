import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
import CreateWorkout from './pages/CreateWorkout'
import Athletes from './pages/Athletes'
import AthleteDetail from './pages/AthleteDetail'
import WorkoutDetail from './pages/WorkoutDetail'
import WorkoutsArchive from './pages/WorkoutsArchive'
import Settings from './pages/Settings'
import Login from './pages/Login'





function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-[#171717] flex items-center justify-center text-[#f1ba17] font-bold">Caricamento...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="pb-16">
      {children}
      <Navbar />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#171717] text-white">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreateWorkout /></ProtectedRoute>} />
          <Route path="/athletes" element={<ProtectedRoute><Athletes /></ProtectedRoute>} />
          <Route path="/athletes/:id" element={<ProtectedRoute><AthleteDetail /></ProtectedRoute>} />
          <Route path="/workout/:id" element={<ProtectedRoute><WorkoutDetail /></ProtectedRoute>} />
          <Route path="/archive" element={<ProtectedRoute><WorkoutsArchive /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App