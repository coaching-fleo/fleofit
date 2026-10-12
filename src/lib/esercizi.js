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
