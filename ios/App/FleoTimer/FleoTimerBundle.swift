import WidgetKit
import SwiftUI

// L'estensione widget di FLEOFIT. Per ora porta solo la Live Activity del timer
// guidato (TimerLiveActivity.swift); il widget quadrato della Home disegnato il
// 29/10/2026 (tools/design-dynamic-island/design-a.html) andrà qui accanto.
@main
struct FleoTimerBundle: WidgetBundle {
    var body: some Widget {
        TimerLiveActivity()
    }
}
