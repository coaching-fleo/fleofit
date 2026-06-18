import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabaseClient';

export const HealthService = {
  async syncLatestWorkout() {
    if (!Capacitor.isNativePlatform()) {
      throw new Error("Apple Health è disponibile solo su iOS.");
    }
    
    let Health;
    try {
      const module = await import('@capgo/capacitor-health');
      Health = module.Health;
    } catch (e) {
      throw new Error("Plugin Health non installato. Esegui 'npm install @capgo/capacitor-health'");
    }

    try {
      await Health.requestAuthorization({
        read: ['workouts', 'calories', 'heartRate'],
        write: []
      });
    } catch (e) {
      throw new Error("Autorizzazione negata da Apple Health: " + (e.message || String(e)));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    let activities = [];
    try {
      const res = await Health.queryWorkouts({
        startDate: today.toISOString(),
        endDate: now.toISOString(),
        limit: 10
      });
      activities = res.workouts; 
    } catch (e) {
      throw new Error("Errore durante la lettura degli allenamenti: " + (e.message || String(e)));
    }

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      throw new Error("Nessun allenamento trovato su Apple Health in data odierna.");
    }

    // Ordiniamo dal più recente al più vecchio
    const sortedWorkouts = activities.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
    const latest = sortedWorkouts[0];

    let avgHr = null;
    try {
      const hrData = await Health.readSamples({ 
        dataType: 'heartRate', 
        startDate: latest.startDate, 
        endDate: latest.endDate, 
        limit: 1000 
      });
      const samples = hrData.samples;
      if (samples && Array.isArray(samples) && samples.length > 0) {
        const sum = samples.reduce((acc, val) => acc + (val.value || 0), 0);
        avgHr = Math.round(sum / samples.length);
      }
    } catch (hrErr) {}

    let duration = null;
    if (latest.duration) {
      duration = Math.round(latest.duration / 60);
    } else if (latest.startDate && latest.endDate) {
      duration = Math.round((new Date(latest.endDate).getTime() - new Date(latest.startDate).getTime()) / 60000);
    }

    let calories = latest.totalEnergyBurned || null;
    return { calories: calories ? Math.round(calories) : null, avgHeartRate: avgHr, duration };
  }
};

export const CloudSyncService = {
  async syncFromCloud(athleteId) {
    // Chiama la Supabase Edge Function che interroga le API di Strava/Garmin per l'atleta
    const { data, error } = await supabase.functions.invoke('cloud-sync', {
      body: { athlete_id: athleteId }
    });

    if (error) throw new Error("Errore durante la sincronizzazione col Cloud: " + error.message);
    if (!data || (!data.duration && !data.calories)) throw new Error("Nessun allenamento recente trovato nel Cloud (Strava/Garmin). Assicurati che l'orologio si sia sincronizzato.");

    return {
      duration: data.duration,       // in minuti
      calories: data.calories,       // kcal
      avgHeartRate: data.avgHeartRate // bpm
    };
  }
};