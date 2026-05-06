import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Calendar from './pages/Calendar'
import CreateWorkout from './pages/CreateWorkout'
import Athletes from './pages/Athletes'
import AthleteDetail from './pages/AthleteDetail'
import WorkoutDetail from './pages/WorkoutDetail'



function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#171717] text-white pb-16">
        <Routes>
          <Route path="/" element={<Calendar />} />
          <Route path="/create" element={<CreateWorkout />} />
          <Route path="/athletes" element={<Athletes />} />
          <Route path="/athletes/:id" element={<AthleteDetail />} />
          <Route path="/workout/:id" element={<WorkoutDetail />} />
        </Routes>
        <Navbar />
      </div>
    </BrowserRouter>
  )
}

export default App