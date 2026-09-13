import Foundation
import Capacitor
import StoreKit

/**
 * IL FOGLIO "TI PIACE DAYALOGUE?" (13 settembre 2026, richiesta di Manuel:
 * gia nel binario, ma dormiente finche /admin non lo accende).
 *
 * SKStoreReviewController.requestReview(in:) chiede ad Apple di mostrare il
 * foglio delle stelle dentro l'app. Apple decide da sola se mostrarlo (al
 * massimo tre volte in 365 giorni per persona, mai in TestFlight, mai due
 * volte di fila) e non dice a nessuno ne se l'ha mostrato ne cosa ha
 * scritto la persona. Qui si risponde "chiesto: true" quando la chiamata e
 * partita; il resto e di Apple.
 *
 * QUANDO chiedere non e deciso qui: e in src/lib/recensione.ts (giornate
 * salvate, interruttore sul server, non piu di una ogni 120 giorni).
 *
 * Registrazione: a mano, in AppViewController.capacitorDidLoad
 * (DockVetro.swift), come Cassaforte, Abbonamento e DeviceCheck.
 */
@objc(RecensionePlugin)
public class RecensionePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RecensionePlugin"
    public let jsName = "Recensione"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "chiedi", returnType: CAPPluginReturnPromise),
    ]

    /// chiedi() -> { chiesto: Bool }
    @objc func chiedi(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let scena = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
                ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
            guard let scena = scena else {
                call.resolve(["chiesto": false])
                return
            }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scena)
            } else {
                SKStoreReviewController.requestReview(in: scena)
            }
            call.resolve(["chiesto": true])
        }
    }
}
