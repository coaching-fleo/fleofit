export const MOTIVATIONS = [
  "Pronto a spaccare oggi? ⚡",
  "La costanza batte il talento. 🔥",
  "Ogni giorno è un'opportunità per migliorare. 💪",
  "Fai in modo che oggi conti. 🎯",
  "Non fermarti quando sei stanco, fermati quando hai finito. 🏁",
  "Il dolore che senti oggi sarà la forza che sentirai domani. 🛡️",
  "La disciplina è il ponte tra gli obiettivi e i risultati. 🌉",
  "Non aspettare il momento perfetto, rendilo perfetto tu. ⏱️",
  "La motivazione ti fa iniziare, l'abitudine ti fa continuare. 🔄",
  "Un passo alla volta. Un giorno alla volta. 🧗‍♂️",
  "Il tuo unico limite sei tu. 🚀",
  "Svegliati con determinazione, vai a letto con soddisfazione. 🌅",
  "Se fosse facile lo farebbero tutti! 🏆",
  "La differenza tra impossibile e possibile sta nella determinazione. 🧠",
  "Ogni allenamento ti avvicina al tuo obiettivo. 📈"
]

export function getDailyMotivation() {
  const today = new Date().toISOString().split('T')[0]
  const savedData = JSON.parse(localStorage.getItem('fleofit_motivation') || '{}')
  
  // Se oggi ha già pescato una frase E quella frase esiste ancora nell'elenco, usiamo quella
  if (savedData.date === today && savedData.quote && MOTIVATIONS.includes(savedData.quote)) return savedData.quote

  // Altrimenti filtriamo via dalla scelta le ultime 10 frasi pescate
  const history = savedData.history || []
  const availableMotivations = MOTIVATIONS.filter(m => !history.includes(m))
  const pool = availableMotivations.length > 0 ? availableMotivations : MOTIVATIONS
  const selectedQuote = pool[Math.floor(Math.random() * pool.length)]
  localStorage.setItem('fleofit_motivation', JSON.stringify({ date: today, quote: selectedQuote, history: [selectedQuote, ...history].slice(0, 10) }))
  return selectedQuote
}