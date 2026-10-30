/**
 * Le tassonomie degli esercizi Hyrox, fino al 12/10/2026 dentro
 * `CreateWorkout.jsx`. Sono uscite di lì perché ora le legge anche
 * `leggiWorkout.js`, che trasforma un workout scritto in blocchi: due copie
 * della stessa lista divergerebbero al primo esercizio aggiunto.
 */

import { ERGOMETERS } from './constants'

export const HYROX_EXERCISES = [
  'Assault Bike', 'Atlas Stone Load', 'Axle Bar Clean', 'Axle Bar Deadlift',
  'Back Lunge', 'Back Squat', 'Bar Muscle-up', 'Bar Pullover', 'Battle Ropes', 'Bear Crawl', 'Box Jump', 'Burpees', 'Burpees Broad Jumps', 'Burpees Jump',
  'Chest-to-Bar', 'Clean', 'Cluster', 'Crossover Double Unders', 'Curve Treadmill',
  'D-Ball Clean', 'Deadlift', 'Deficit Deadlift', 'Deficit Handstand Push-up', 'Devil Press', 'Double Unders', 'Dragon Flag', 'Dual Dumbbell Clean and Jerk', 'Dual Dumbbell Snatch', 'Dumbbell Box Step-Over', 'Dumbbell Snatch', 'Dumbbell Step-Up',
  'Echo Bike',
  'Farmers Carry', 'Farmers Walk', 'Freestanding Handstand Push-up', 'Front Lunge', 'Front Squat',
  'GHD Back Extension', 'GHD Hip Extension', 'GHD Sit-up', 'Good Morning',
  'Handstand Push-up', 'Handstand Walk', 'Hang Power Clean', 'Hang Power Snatch', 'Hang Squat Clean', 'Hang Squat Snatch', 'Hollow Body Hold', 'Hollow Rock',
  'Jumping Jack', 'Jumping Muscle-up',
  'Kettlebell Clean and Press', 'Kettlebell Goblet Squat', 'Kettlebell Snatch', 'Kettlebell Swing',
  'L-Sit', 'Log Press',
  'Man Maker', 'Military Press', 'Muscle Clean', 'Muscle Snatch',
  'Overhead Squat', 'Overhead Walking Lunge',
  'Pegboard Ascent', 'Pistol Squat', 'Plank', 'Power Clean', 'Power Snatch', 'Prowler Push', 'Pull-up', 'Push Jerk', 'Push Press', 'Push Up',
  'Rest', 'Ring Dips', 'Ring Muscle-up', 'Romanian Deadlift', 'Rope Climb', 'Rowing', 'Run',
  'Sandbag Bear Hug Squat', 'Sandbag Carry', 'Sandbag Lunges', 'Sandbag Over Shoulder', 'Shuttle Run', 'SkiErg', 'Skin the Cat', 'Sled Drag', 'Sled Pull', 'Sled Push', 'Snatch Balance', 'Sots Press', 'Split Jerk', 'Squat', 'Squat Clean', 'Squat Jack', 'Squat Snatch', 'Strict Handstand Push-up', 'Strict Muscle-up', 'Strict Press', 'Strict Pull-up', 'Suitcase Carry', 'Suitcase Deadlift', 'Sumo Deadlift', 'Sumo Deadlift High Pull', 'Superman Rock', 'Swim',
  'Thruster', 'Tire Flip', 'Toes-to-Bar', 'Triple Unders', 'TrueForm Runner', 'Turkish Get-Up',
  'V-Up',
  "Waiter's Walk", 'Wall Balls', 'Wall Walk', 'Weighted Pull-up',
  'Yoke Carry',
  'Zercher Squat'
]

/**
 * Le otto stazioni di una gara HYROX, nell'ordine in cui si fanno (fra l'una e
 * l'altra c'è 1 km di corsa). Stanno in cima alla lista del builder: sono i
 * movimenti che il coach programma più spesso, e cercarli in mezzo a 130 voci
 * alfabetiche era la parte lenta (richiesta del committente, 30/10/2026).
 */
export const STAZIONI_HYROX = [
  'SkiErg', 'Sled Push', 'Sled Pull', 'Burpees Broad Jumps',
  'Rowing', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls',
]

export const isErgo = (name) => ERGOMETERS.includes(name)

export const SLED_EXERCISES = ['Sled Push', 'Sled Pull', 'Prowler Push', 'Sled Drag']
export const isSled = (name) => SLED_EXERCISES.includes(name)
export const CARRY_EXERCISES = ['Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', "Waiter's Walk", 'Handstand Walk', 'Bear Crawl']
export const isCarry = (name) => CARRY_EXERCISES.includes(name)
export const DISTANCE_EXERCISES = [
  'Farmers Carry', 'Farmers Walk', 'Suitcase Carry', 'Sandbag Carry', 'Yoke Carry', 
  "Waiter's Walk", 'Handstand Walk', 'Run', 'Bear Crawl', 'Shuttle Run', 'Swim'
]

export const HYBRID_EXERCISES = ['Sandbag Lunges', 'Burpees Broad Jumps']
export const isHybrid = (name) => HYBRID_EXERCISES.includes(name)

export const isDistance = (name) => isErgo(name) || isSled(name) || DISTANCE_EXERCISES.includes(name)

/**
 * Le famiglie della lista «Scegli esercizio» (design B, scelto dal committente
 * il 30/10/2026): una pillola per famiglia, e a schermo se ne vede una sola.
 * Un elenco di 130 nomi alfabetici non si leggeva. Le stazioni stanno anche
 * nella loro famiglia: chi apre «Ergometri» si aspetta di trovarci lo SkiErg.
 * ⚠️ Un esercizio nuovo in HYROX_EXERCISES va messo anche qui: un test
 * (esercizi.test.js) fallisce finché non ha una famiglia.
 */
export const FAMIGLIE_HYROX = [
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

/**
 * Come si misura un esercizio, in breve, per la riga della lista: le stesse
 * regole che decidono le schede del foglio misure in `ExercisePicker`.
 * Un esercizio custom ha le regole di uno qualunque: ripetizioni e peso.
 */
export const misuraEsercizio = (name) =>
  name === 'Rest' ? 'tempo'
  : isErgo(name) || name === 'Run' ? 'metri · ritmo'
  : isHybrid(name) ? 'reps o metri · kg'
  : isDistance(name) ? 'metri · kg'
  : 'reps · kg'
