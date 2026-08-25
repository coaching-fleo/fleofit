import { Capacitor } from '@capacitor/core';

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
      throw new Error("Plugin Health non installato. Esegui 'npm install @capgo/capacitor-health'", { cause: e });
    }

    try {
      await Health.requestAuthorization({
        read: ['workouts', 'calories', 'heartRate'],
        write: []
      });
    } catch (e) {
      throw new Error("Autorizzazione negata da Apple Health: " + (e.message || String(e)), { cause: e });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    let activities;
    try {
      const res = await Health.queryWorkouts({
        startDate: today.toISOString(),
        endDate: now.toISOString(),
        limit: 10
      });
      activities = res.workouts; 
    } catch (e) {
      throw new Error("Errore durante la lettura degli allenamenti: " + (e.message || String(e)), { cause: e });
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
    } catch (hrErr) {
      // Senza permesso sui battiti avgHr resta null e la nota si salva lo stesso,
      // solo senza frequenza media: degradare è corretto, sparire in silenzio no.
      console.warn('Frequenza cardiaca non leggibile da Apple Health:', hrErr)
    }

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
