import Foundation
#if canImport(ActivityKit)
import ActivityKit

// La Live Activity del timer guidato (design A «Anello», 29/10/2026).
//
// ⚠️ Questo file sta in DUE target: l'app (che la apre e la aggiorna, da
// LiveActivityPlugin.swift) e l'estensione FleoTimer (che la disegna, da
// TimerLiveActivity.swift). Devono vedere la stessa struttura, o iOS non sa
// decodificare lo stato. Un campo nuovo va aggiunto qui, nel plugin e in
// `statoLiveActivity` di src/lib/liveActivity.js.
@available(iOS 16.1, *)
struct AttivitaTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var fase: String            // prep · work · rest · stopwatch · done
        var etichetta: String       // ON, OFF, EMOM, RIPOSO…
        var titolo: String
        var compito: String
        var poi: String
        var giro: Int               // 0 = senza giri
        var giri: Int
        var colore: String          // #rrggbb
        var inizio: Date?           // inizio del passo (o del cronometro)
        var fine: Date?             // fine del passo; nil in pausa o a cronometro
        var restante: Int           // secondi sul quadrante quando è fermo
        var frazione: Double        // quanto resta del passo, 0…1, quando è fermo
        var inPausa: Bool
        var cronometro: Bool
        var inizioAllenamento: Date?
        var fineAllenamento: Date?
        var avanzamento: Double     // quanto è fatto dell'allenamento, 0…1
        var totale: Int             // secondi dell'allenamento intero
    }

    var titoloWorkout: String
    var categoria: String
}
#endif
