import { useState } from 'react'
import { createPortal } from 'react-dom'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, parseISO, isValid } from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'

export default function CustomDatePicker({ date, onChange, placeholder = "Seleziona data", className = "" }) {
  const [isOpen, setIsOpen] = useState(false)
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (date) {
      const d = parseISO(date)
      if (isValid(d)) return d
    }
    return new Date()
  })
  
  const displayDate = date && isValid(parseISO(date)) ? format(parseISO(date), 'EEEE d MMMM yyyy', { locale: it }) : ''

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })
  
  const firstDayOfMonth = startOfMonth(currentMonth).getDay()
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1

  const handleSelect = (d) => {
    onChange(format(d, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCurrentMonth(date && isValid(parseISO(date)) ? parseISO(date) : new Date())
          setIsOpen(true)
        }}
        className={`flex items-center gap-3 w-full text-left transition ${className}`}
      >
        <CalendarIcon size={18} className={displayDate ? "text-[#f1ba17]" : "text-gray-500"} />
        <span className={`flex-1 truncate ${displayDate ? "text-white font-medium capitalize" : "text-gray-500"}`}>
          {displayDate || placeholder}
        </span>
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 bg-black/85 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
          <div className="bg-[#1e1e1e] border border-[#333] rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-xl bg-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#f1ba17] hover:text-black transition">
                <ChevronLeft size={20} />
              </button>
              <span className="text-white font-bold text-lg capitalize">{format(currentMonth, 'MMMM yyyy', { locale: it })}</span>
              <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-xl bg-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#f1ba17] hover:text-black transition">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-center text-gray-500 text-xs font-bold py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
              {days.map(d => {
                const isSelected = date && isSameDay(d, parseISO(date))
                const isTodayDate = isToday(d)
                return (
                  <button key={d.toISOString()} type="button" onClick={() => handleSelect(d)}
                    className={`aspect-square rounded-full flex items-center justify-center text-sm font-medium transition-all ${isSelected ? 'bg-[#f1ba17] text-black font-bold shadow-lg shadow-[#f1ba17]/20 scale-105' : isTodayDate ? 'bg-[#2a2a2a] text-[#f1ba17]' : 'text-gray-300 hover:bg-[#2a2a2a] hover:text-white'}`}>
                    {format(d, 'd')}
                  </button>
                )
              })}
            </div>
            
            <div className="mt-6 pt-4 border-t border-[#333] flex justify-end">
              <button type="button" onClick={() => setIsOpen(false)} className="text-sm font-semibold text-gray-400 hover:text-white transition">
                Annulla
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}