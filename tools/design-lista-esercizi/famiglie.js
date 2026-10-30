// Prototipo di design: le famiglie degli esercizi Hyrox per la lista del
// builder. NON fa parte dell'app. Ogni nome è uno di HYROX_EXERCISES
// (src/lib/esercizi.js): `controlla()` in fondo lo verifica nella console.

window.STAZIONI = ['SkiErg', 'Sled Push', 'Sled Pull', 'Burpees Broad Jumps', 'Rowing', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls']

window.FAMIGLIE = [
  { id: 'corsa', nome: 'Corsa e recupero', voci: ['Run', 'Shuttle Run', 'Swim', 'Rest'] },
  { id: 'ergo', nome: 'Ergometri', voci: ['SkiErg', 'Rowing', 'Assault Bike', 'Echo Bike', 'TrueForm Runner', 'Curve Treadmill'] },
  { id: 'slitte', nome: 'Slitte e trasporti', voci: ['Sled Push', 'Sled Pull', 'Prowler Push', 'Sled Drag', 'Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', "Waiter's Walk", 'Bear Crawl', 'Tire Flip', 'Atlas Stone Load', 'Sandbag Over Shoulder'] },
  { id: 'gambe', nome: 'Gambe e affondi', voci: ['Wall Balls', 'Sandbag Lunges', 'Back Lunge', 'Front Lunge', 'Overhead Walking Lunge', 'Squat', 'Back Squat', 'Front Squat', 'Overhead Squat', 'Pistol Squat', 'Zercher Squat', 'Sandbag Bear Hug Squat', 'Kettlebell Goblet Squat', 'Thruster', 'Box Jump', 'Dumbbell Box Step-Over', 'Dumbbell Step-Up', 'Squat Jack'] },
  { id: 'stacchi', nome: 'Stacchi e tirate', voci: ['Deadlift', 'Deficit Deadlift', 'Romanian Deadlift', 'Sumo Deadlift', 'Sumo Deadlift High Pull', 'Suitcase Deadlift', 'Axle Bar Deadlift', 'Good Morning', 'Kettlebell Swing'] },
  { id: 'olimpici', nome: 'Olimpici', voci: ['Clean', 'Power Clean', 'Squat Clean', 'Hang Power Clean', 'Hang Squat Clean', 'Muscle Clean', 'Axle Bar Clean', 'D-Ball Clean', 'Snatch Balance', 'Power Snatch', 'Squat Snatch', 'Hang Power Snatch', 'Hang Squat Snatch', 'Muscle Snatch', 'Sots Press', 'Cluster', 'Push Press', 'Push Jerk', 'Split Jerk'] },
  { id: 'manubri', nome: 'Manubri e kettlebell', voci: ['Devil Press', 'Dual Dumbbell Clean and Jerk', 'Dual Dumbbell Snatch', 'Dumbbell Snatch', 'Kettlebell Clean and Press', 'Kettlebell Snatch', 'Turkish Get-Up', 'Man Maker'] },
  { id: 'spinta', nome: 'Spinta', voci: ['Push Up', 'Military Press', 'Strict Press', 'Log Press', 'Ring Dips', 'Handstand Push-up', 'Strict Handstand Push-up', 'Deficit Handstand Push-up', 'Freestanding Handstand Push-up'] },
  { id: 'ginnastica', nome: 'Trazioni e ginnastica', voci: ['Pull-up', 'Strict Pull-up', 'Weighted Pull-up', 'Chest-to-Bar', 'Toes-to-Bar', 'Bar Muscle-up', 'Ring Muscle-up', 'Strict Muscle-up', 'Jumping Muscle-up', 'Rope Climb', 'Pegboard Ascent', 'Skin the Cat', 'Bar Pullover', 'Handstand Walk', 'Wall Walk'] },
  { id: 'salti', nome: 'Burpees, salti e corda', voci: ['Burpees Broad Jumps', 'Burpees', 'Burpees Jump', 'Double Unders', 'Crossover Double Unders', 'Triple Unders', 'Jumping Jack', 'Battle Ropes'] },
  { id: 'core', nome: 'Core', voci: ['Plank', 'Hollow Body Hold', 'Hollow Rock', 'L-Sit', 'V-Up', 'GHD Sit-up', 'GHD Back Extension', 'GHD Hip Extension', 'Superman Rock', 'Dragon Flag'] },
]

// Come si misura: la stessa regola di `misure` in ExercisePicker.
const ERGO = ['SkiErg', 'Rowing', 'Assault Bike', 'Echo Bike', 'TrueForm Runner', 'Curve Treadmill']
const SLED = ['Sled Push', 'Sled Pull', 'Prowler Push', 'Sled Drag']
const DIST = ['Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', "Waiter's Walk", 'Handstand Walk', 'Bear Crawl', 'Shuttle Run', 'Swim']
const IBRIDI = ['Sandbag Lunges', 'Burpees Broad Jumps']
window.misuraDi = (n) =>
  n === 'Rest' ? 'tempo'
  : n === 'Run' ? 'metri · ritmo'
  : ERGO.includes(n) ? 'metri · ritmo'
  : SLED.includes(n) || DIST.includes(n) ? 'metri · kg'
  : IBRIDI.includes(n) ? 'reps o metri · kg'
  : 'reps · kg'

window.controlla = (tutti) => {
  const messi = new Set(window.FAMIGLIE.flatMap(f => f.voci))
  const mancano = tutti.filter(n => !messi.has(n))
  const estranei = [...messi].filter(n => !tutti.includes(n))
  console.log('mancano:', mancano, 'estranei:', estranei)
  return { mancano, estranei }
}
