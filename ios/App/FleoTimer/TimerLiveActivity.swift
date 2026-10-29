import ActivityKit
import WidgetKit
import SwiftUI

// La Live Activity del timer guidato, design A «Anello» (scelto il 29/10/2026;
// il prototipo è tools/design-dynamic-island/design-a.html).
//
// Tre posti, un linguaggio solo: l'anello è il tempo che RESTA del passo e si
// svuota; il tempo è nel colore della fase (categoria per il lavoro, verde per
// il riposo, bianco per la preparazione).
//
// ⚠️ Niente qui si aggiorna da solo, tranne due cose che iOS anima per conto
// suo: `Text(timerInterval:)` e `ProgressView(timerInterval:)`. Sono loro a far
// scorrere tempo e anello fra un passo e l'altro. Il cambio di passo lo manda
// l'app (col telefono bloccato, l'orologio nativo di LiveActivityPlugin.swift):
// se non arriva in tempo, `isStale` è vero e la riga in basso dice di aprire FLEOFIT.

// 🔴 Il tocco apre l'app con un link SUO: con `fleofit://` e basta l'app lo
// prendeva per un login fallito e ricaricava tutto, chiudendo il timer.
// Deve coincidere con LINK_TIMER di src/lib/linkTimer.js.
private let linkTimer = "fleofit://timer"

struct TimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AttivitaTimerAttributes.self) { contesto in
            BloccoSchermo(contesto: contesto)
                .activityBackgroundTint(Color.black.opacity(0.55))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: linkTimer))
        } dynamicIsland: { contesto in
            let s = contesto.state
            let tinta = Color(esadecimale: s.colore)
            return DynamicIsland {
                // Espansa: regioni leading / trailing accanto alla fotocamera,
                // center sotto, bottom in fondo (HIG, Live Activities).
                DynamicIslandExpandedRegion(.leading) {
                    Anello(stato: s, tinta: tinta)
                        .overlay(Text(s.giroCorto).font(.system(size: 12, weight: .bold, design: .rounded)).foregroundStyle(.white))
                        .frame(width: 44, height: 44)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Tempo(stato: s, dimensione: 36)
                        .foregroundStyle(tinta)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 1) {
                        Text(s.etichetta).font(.caption.weight(.heavy)).foregroundStyle(tinta)
                        Text(s.riga).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(s.compitoVisibile).font(.headline).lineLimit(1)
                        Text(contesto.isStale ? "Apri FLEOFIT per il passo successivo" : s.poi)
                            .font(.caption.weight(.semibold)).foregroundStyle(.secondary).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
                    .padding(.top, 4)
                }
            } compactLeading: {
                Anello(stato: s, tinta: tinta)
                    .overlay(Glifo(fase: s.fase).font(.system(size: 8, weight: .black)).foregroundStyle(tinta))
                    .frame(width: 20, height: 20)
            } compactTrailing: {
                // 🔴 Con un'altra attività accanto (Spotify) iOS mette leading e
                // trailing tutti a sinistra della fotocamera: dopo l'anello
                // restano circa 30 pt, e «0:12» a 15 pt ne vuole 34. Tagliato
                // sempre nello stesso punto, qualunque cornice gli si desse
                // (screenshot del 29/10/2026). Qui iOS sceglie il primo che ci sta.
                ViewThatFits(in: .horizontal) {
                    Tempo(stato: s, dimensione: 15)
                    Tempo(stato: s, dimensione: 13)
                    Tempo(stato: s, dimensione: 11)
                }
                .foregroundStyle(tinta)
            } minimal: {
                Anello(stato: s, tinta: tinta)
                    .overlay(Glifo(fase: s.fase).font(.system(size: 8, weight: .black)).foregroundStyle(tinta))
                    .frame(width: 22, height: 22)
            }
            .keylineTint(tinta)
            .widgetURL(URL(string: linkTimer))
        }
    }
}

// ───────── Blocco schermo ─────────
// Altezza sotto i 160 pt; il sistema dà margini e angoli. Con lo schermo sempre
// acceso (isLuminanceReduced) i colori si attenuano.
private struct BloccoSchermo: View {
    let contesto: ActivityViewContext<AttivitaTimerAttributes>
    @Environment(\.isLuminanceReduced) private var attenuato

    var body: some View {
        let s = contesto.state
        let tinta = Color(esadecimale: s.colore).opacity(attenuato ? 0.7 : 1)
        VStack(spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Anello(stato: s, tinta: tinta)
                    .overlay(Text(s.giroCorto).font(.system(size: 13, weight: .bold, design: .rounded)).foregroundStyle(.white))
                    .frame(width: 52, height: 52)
                VStack(alignment: .leading, spacing: 1) {
                    (Text("FLEO").foregroundColor(.white.opacity(0.55))
                     + Text("FIT").foregroundColor(Color(esadecimale: "#f1ba17"))
                     + Text(" · \(contesto.attributes.categoria)").foregroundColor(.white.opacity(0.55)))
                        .font(.system(size: 11, weight: .heavy))
                        .lineLimit(1)
                    Text(s.compitoVisibile).font(.headline).foregroundStyle(.white).lineLimit(1)
                    Text(s.riga).font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                }
                Spacer(minLength: 4)
                Tempo(stato: s, dimensione: 38)
                    .foregroundStyle(tinta)
            }
            VStack(alignment: .leading, spacing: 6) {
                BarraAllenamento(stato: s, tinta: tinta)
                Text(contesto.isStale ? "Apri FLEOFIT per il passo successivo" : s.poi)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.6))
                    .lineLimit(1)
            }
        }
        .padding(16)
    }
}

// ───────── Pezzi ─────────

/// L'anello: il tempo che resta del passo. In corsa lo anima iOS
/// (`ProgressView(timerInterval:)`), fermo mostra la frazione rimasta.
private struct Anello: View {
    let stato: AttivitaTimerAttributes.ContentState
    let tinta: Color

    var body: some View {
        Group {
            if let inizio = stato.inizio, let fine = stato.fine, !stato.inPausa, fine > inizio {
                ProgressView(timerInterval: inizio...fine, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
            } else {
                ProgressView(value: min(max(stato.frazione, 0), 1))
            }
        }
        .progressViewStyle(.circular)
        .tint(tinta)
    }
}

/// Il tempo: a scendere in corsa, a salire a cronometro, fermo in pausa,
/// il totale a fine allenamento. Cifre a larghezza fissa.
///
/// 🔴 `Text(timerInterval:)` NON SA MISURARSI: va dentro una cornice di
/// larghezza data, e la larghezza va calcolata qui, dalle cifre che il tempo
/// può avere in questo passo e dalla dimensione del carattere. Due errori già
/// fatti il 29/10/2026, provati sul telefono:
/// - cornice fissa da 46 pt per ogni durata, più `minimumScaleFactor`: con
///   Spotify accanto nell'isola compatta si leggeva «0:0» invece di «0:03»;
/// - testo modello `.hidden()` con il tempo in `.overlay` e `.fixedSize()`: nel
///   disegno delle Live Activity il tempo spariva del tutto.
/// Quindi: un testo solo, una `frame(width:)` calcolata, niente scala.
private struct Tempo: View {
    let stato: AttivitaTimerAttributes.ContentState
    let dimensione: CGFloat

    var body: some View {
        valore
            .font(.system(size: dimensione, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
            .lineLimit(1)
            .frame(width: larghezza, alignment: .trailing)
    }

    @ViewBuilder private var valore: some View {
        if stato.fase == "done" {
            Text(mmss(stato.totale))
        } else if stato.cronometro, let inizio = stato.inizio, !stato.inPausa {
            Text(inizio, style: .timer)
        } else if let fine = stato.fine, !stato.inPausa, fine > Date() {
            Text(timerInterval: Date()...fine, countsDown: true)
        } else {
            Text(mmss(stato.restante))
        }
    }

    /// Cifre e due punti che il tempo può arrivare a mostrare in questo passo:
    /// a scendere non supera il punto di partenza; un cronometro sale, quindi
    /// almeno due cifre di minuti. Con le cifre a larghezza fissa una cifra di
    /// SF Rounded semibold è circa 0,6 volte il carattere, i due punti 0,3
    /// (misurato sul Mac il 29/10: «0:03» a 15 pt = 34,2 pt); più un 25% di
    /// margine, perché tagliare è peggio che lasciare aria.
    private var larghezza: CGFloat {
        let secondi: Int
        if stato.fase == "done" {
            secondi = stato.totale
        } else if stato.cronometro {
            secondi = max(600, stato.restante)
        } else {
            secondi = stato.restante
        }
        let (cifre, duePunti): (CGFloat, CGFloat) = secondi >= 3600 ? (5, 2) : secondi >= 600 ? (4, 1) : (3, 1)
        return ceil((cifre * 0.6 + duePunti * 0.3) * dimensione * 1.25)
    }
}

/// L'allenamento intero, sottile, sotto: quanto è fatto.
private struct BarraAllenamento: View {
    let stato: AttivitaTimerAttributes.ContentState
    let tinta: Color

    var body: some View {
        Group {
            if let a = stato.inizioAllenamento, let b = stato.fineAllenamento, !stato.inPausa, b > a {
                ProgressView(timerInterval: a...b, countsDown: false, label: { EmptyView() }, currentValueLabel: { EmptyView() })
            } else {
                ProgressView(value: min(max(stato.avanzamento, 0), 1))
            }
        }
        .progressViewStyle(.linear)
        .tint(tinta)
    }
}

/// Il simbolo della fase, per chi non distingue i colori.
private struct Glifo: View {
    let fase: String
    var body: some View {
        switch fase {
        case "rest": Image(systemName: "wind")
        case "done": Image(systemName: "checkmark")
        case "prep": Image(systemName: "circle.fill")
        case "stopwatch": Image(systemName: "stopwatch")
        default: Image(systemName: "bolt.fill")
        }
    }
}

private extension AttivitaTimerAttributes.ContentState {
    var giroCorto: String { giro > 0 ? "\(giro)/\(giri)" : (fase == "done" ? "✓" : "") }
    var riga: String { giro > 0 ? "Giro \(giro) di \(giri)" : titolo }
    var compitoVisibile: String { fase == "done" ? "Completato" : compito }
}

private func mmss(_ secondi: Int) -> String {
    let s = max(0, secondi)
    return "\(s / 60):" + String(format: "%02d", s % 60)
}

private extension Color {
    /// `#rrggbb` → Color. Un valore illeggibile diventa il giallo FLEOFIT.
    init(esadecimale: String) {
        var testo = esadecimale.trimmingCharacters(in: .whitespaces)
        if testo.hasPrefix("#") { testo.removeFirst() }
        var valore: UInt64 = 0
        guard testo.count == 6, Scanner(string: testo).scanHexInt64(&valore) else {
            self = Color(red: 241 / 255, green: 186 / 255, blue: 23 / 255)
            return
        }
        self = Color(red: Double((valore >> 16) & 0xff) / 255,
                     green: Double((valore >> 8) & 0xff) / 255,
                     blue: Double(valore & 0xff) / 255)
    }
}
