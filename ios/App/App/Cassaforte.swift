import Foundation
import Capacitor
import Security

/**
 * IL PORTACHIAVI DELLA CASSAFORTE (SPEC ospite-e-cassaforte, R8).
 *
 * Tiene il seme del diario (dieci byte, quelli che diventano le otto parole)
 * nel Keychain di iOS, con `kSecAttrSynchronizable = true`: cosi viaggia da
 * solo, cifrato da Apple, fra iPhone, iPad e Mac dello stesso Apple ID. Chi
 * cambia telefono e lo ripristina non deve fare niente.
 *
 * Accessibilita `kSecAttrAccessibleAfterFirstUnlock`: il seme serve anche a
 * un'app che riparte in sottofondo (il backup notturno, R9) e non ha senso
 * legarlo allo sblocco corrente; e comunque non e leggibile a telefono
 * spento. Face ID resta il lucchetto della schermata, non della chiave.
 *
 * Nessun metodo esporta niente altrove: leggi, scrivi, cancella. Il seme
 * viaggia come base64, mai come stringa di parole.
 *
 * Registrazione: a mano, in AppViewController.capacitorDidLoad (DockVetro.swift).
 * Capacitor scopre da solo SOLO i plugin dei pacchetti npm (packageClassList
 * in capacitor.config.json): un plugin che vive dentro l'app senza quella
 * riga non esiste, e da JavaScript si vede "not implemented on ios".
 */
@objc(CassafortePlugin)
public class CassafortePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CassafortePlugin"
    public let jsName = "Cassaforte"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "leggi", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scrivi", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancella", returnType: CAPPluginReturnPromise),
    ]

    private let servizio = "com.manuelvisuals.dayalogue.cassaforte"

    private func base(_ conto: String) -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servizio,
            kSecAttrAccount as String: conto,
            kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
        ]
    }

    /// leggi({ conto }) -> { seme: base64 | null }
    @objc func leggi(_ call: CAPPluginCall) {
        let conto = call.getString("conto") ?? "diario"
        var q = base(conto)
        q[kSecReturnData as String] = kCFBooleanTrue
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        let stato = SecItemCopyMatching(q as CFDictionary, &out)
        if stato == errSecItemNotFound {
            call.resolve(["seme": NSNull()])
            return
        }
        guard stato == errSecSuccess, let dati = out as? Data else {
            call.reject("keychain: \(stato)")
            return
        }
        call.resolve(["seme": dati.base64EncodedString()])
    }

    /// scrivi({ conto, seme: base64 }) -> {}
    @objc func scrivi(_ call: CAPPluginCall) {
        let conto = call.getString("conto") ?? "diario"
        guard let b64 = call.getString("seme"), let dati = Data(base64Encoded: b64) else {
            call.reject("seme mancante")
            return
        }
        var q = base(conto)
        // via l'eventuale valore precedente, poi si scrive: SecItemUpdate con
        // la sincronizzazione ha un comportamento diverso fra versioni di iOS
        SecItemDelete(q as CFDictionary)
        q[kSecValueData as String] = dati
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let stato = SecItemAdd(q as CFDictionary, nil)
        guard stato == errSecSuccess else {
            call.reject("keychain: \(stato)")
            return
        }
        call.resolve()
    }

    /// cancella({ conto }) -> {}
    @objc func cancella(_ call: CAPPluginCall) {
        let conto = call.getString("conto") ?? "diario"
        let stato = SecItemDelete(base(conto) as CFDictionary)
        guard stato == errSecSuccess || stato == errSecItemNotFound else {
            call.reject("keychain: \(stato)")
            return
        }
        call.resolve()
    }
}
