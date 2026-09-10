import Foundation
import Capacitor
import DeviceCheck

/**
 * IL TOKEN DEVICECHECK (audit del 10 settembre 2026, decisione 2A di Manuel).
 *
 * Il regalo delle dieci giornate con l'AI e legato a un braccialetto che il
 * dispositivo genera da solo; fino a ieri il server ne accettava uno
 * qualunque, e un ciclo di curl si faceva regalare OpenAI all'infinito. Da
 * oggi il braccialetto nasce sul server solo con un token di questo plugin:
 * DCDevice.generateToken produce una prova che solo Apple sa leggere, e il
 * server chiede ad Apple i due bit del dispositivo ("il regalo l'ha gia
 * avuto?"). I bit vivono presso Apple e sopravvivono alla disinstallazione
 * e alla cancellazione del telefono.
 *
 * Il token e opaco e vale una volta: qui non si conserva niente. Sul
 * simulatore DCDevice non e supportato (isSupported = false): si risponde
 * null e il server, in sviluppo, e senza DeviceCheck comunque.
 *
 * Registrazione: a mano, in AppViewController.capacitorDidLoad
 * (DockVetro.swift), come Cassaforte e Abbonamento.
 */
@objc(DeviceCheckPlugin)
public class DeviceCheckPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DeviceCheckPlugin"
    public let jsName = "DeviceCheck"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "token", returnType: CAPPluginReturnPromise),
    ]

    /// token() -> { token: base64 | null }
    @objc func token(_ call: CAPPluginCall) {
        let dispositivo = DCDevice.current
        guard dispositivo.isSupported else {
            call.resolve(["token": NSNull()])
            return
        }
        dispositivo.generateToken { dati, errore in
            if let dati = dati, errore == nil {
                call.resolve(["token": dati.base64EncodedString()])
            } else {
                // Niente token e un esito, non un guasto: il server decide.
                call.resolve(["token": NSNull()])
            }
        }
    }
}
