import Foundation
import Capacitor
import StoreKit

/**
 * IL NEGOZIO DI APPLE (In-App Purchase, StoreKit 2). Deciso da Manuel il
 * 4 settembre 2026, mockup design/mockups/abbonamento-iphone.html v3.
 *
 * Il telefono NON accende mai premium da solo: compra, riceve da Apple la
 * transazione firmata (un JWS), la passa a JavaScript, che la manda al
 * nostro server (/api/apple/verifica). E il server, dopo aver chiesto ad
 * Apple, a scrivere il piano. Qui ci sono solo quattro cose:
 *
 *   prodotti({ ids })   -> { prodotti: [{ id, prezzo, valuta, periodo,
 *                          provaGiorni }] }  prezzo e prova come li dice
 *                          Apple, gia formattati nella lingua della persona
 *   compra({ id })      -> { esito: "ok", jws, transactionId,
 *                          originalTransactionId, productId }
 *                        | { esito: "annullato" } | { esito: "in_attesa" }
 *   ripristina()        -> { jws: [ ... ] }  le transazioni valide adesso
 *                          per questo Apple ID (Transaction.currentEntitlements)
 *   gestisci()          -> apre il foglio "Abbonamenti" di Apple
 *
 * Piu un ascoltatore (Transaction.updates): rinnovi, disdette e acquisti
 * fatti fuori dall'app arrivano a JavaScript come evento "transazione", con
 * il JWS, cosi il server viene aggiornato anche senza toccare il muro.
 * Ogni transazione va segnata "finita" (transaction.finish()) DOPO che il
 * server l'ha vista: se non la finiamo Apple la ripropone al prossimo avvio,
 * che e esattamente la rete di sicurezza che vogliamo.
 *
 * Registrazione: a mano, in AppViewController.capacitorDidLoad
 * (DockVetro.swift), come Cassaforte.
 */
@objc(AbbonamentoPlugin)
public class AbbonamentoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AbbonamentoPlugin"
    public let jsName = "Abbonamento"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prodotti", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "compra", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ripristina", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "gestisci", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finisci", returnType: CAPPluginReturnPromise),
    ]

    private var ascolto: Task<Void, Never>?

    public override func load() {
        // Le transazioni che arrivano fuori da un acquisto (rinnovo, ripristino
        // da un altro dispositivo, esito di un "in attesa" approvato da un
        // genitore): si passano a JavaScript cosi come sono.
        ascolto = Task.detached { [weak self] in
            for await esito in Transaction.updates {
                guard let self = self else { return }
                if case .verified(let t) = esito {
                    self.notifyListeners("transazione", data: self.descrivi(t, jws: esito.jwsRepresentation))
                }
            }
        }
    }

    deinit {
        ascolto?.cancel()
    }

    private func descrivi(_ t: Transaction, jws: String) -> [String: Any] {
        return [
            "jws": jws,
            "transactionId": String(t.id),
            "originalTransactionId": String(t.originalID),
            "productId": t.productID,
        ]
    }

    /// prodotti({ ids: [String] }) -> { prodotti: [...] }
    @objc func prodotti(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do {
                let lista = try await Product.products(for: ids)
                var out: [[String: Any]] = []
                for p in lista {
                    var voce: [String: Any] = [
                        "id": p.id,
                        "prezzo": p.displayPrice,
                        "valuta": p.priceFormatStyle.currencyCode,
                        "nome": p.displayName,
                    ]
                    if let sub = p.subscription {
                        voce["periodo"] = self.periodo(sub.subscriptionPeriod)
                        if let intro = sub.introductoryOffer, intro.paymentMode == .freeTrial {
                            voce["provaGiorni"] = self.giorni(intro.period)
                        }
                        // La prova la da Apple una volta sola per Apple ID:
                        // se questo ID l'ha gia usata, il tasto non deve
                        // prometterla (isEligibleForIntroOffer).
                        voce["provaDisponibile"] = await sub.isEligibleForIntroOffer
                    }
                    out.append(voce)
                }
                call.resolve(["prodotti": out])
            } catch {
                call.reject("storekit: \(error.localizedDescription)")
            }
        }
    }

    private func periodo(_ p: Product.SubscriptionPeriod) -> String {
        switch p.unit {
        case .day: return p.value == 7 ? "settimana" : "giorno"
        case .week: return "settimana"
        case .month: return p.value == 12 ? "anno" : "mese"
        case .year: return "anno"
        @unknown default: return "mese"
        }
    }

    private func giorni(_ p: Product.SubscriptionPeriod) -> Int {
        switch p.unit {
        case .day: return p.value
        case .week: return p.value * 7
        case .month: return p.value * 30
        case .year: return p.value * 365
        @unknown default: return p.value
        }
    }

    /// compra({ id }) -> { esito, jws?, transactionId?, originalTransactionId?, productId? }
    @objc func compra(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("manca id")
            return
        }
        Task {
            do {
                guard let prodotto = try await Product.products(for: [id]).first else {
                    call.reject("prodotto non trovato: \(id)")
                    return
                }
                // Le transazioni APERTE e gia scadute di questo prodotto si
                // chiudono prima: StoreKit, a un nuovo acquisto, ripropone una
                // transazione aperta al posto di venderne una nuova (5-6
                // settembre 2026: la ricevuta del giorno prima tornava a ogni
                // "Compra"). Una transazione scaduta non da nessun diritto:
                // chiuderla qui non toglie niente a nessuno.
                await self.chiudiLeScadute(di: id)
                var risultato = try await prodotto.purchase()
                // Se Apple ha restituito comunque una transazione gia scaduta,
                // non e una vendita: si chiude e si riprova una volta.
                if case .success(let v) = risultato, case .verified(let t) = v,
                   let fine = t.expirationDate, fine < Date() {
                    await t.finish()
                    risultato = try await prodotto.purchase()
                }
                switch risultato {
                case .success(let verifica):
                    switch verifica {
                    case .verified(let t):
                        var d = self.descrivi(t, jws: verifica.jwsRepresentation)
                        d["esito"] = "ok"
                        call.resolve(d)
                    case .unverified(_, let errore):
                        call.reject("transazione non verificata: \(errore.localizedDescription)")
                    }
                case .userCancelled:
                    call.resolve(["esito": "annullato"])
                case .pending:
                    // "In famiglia": un genitore deve approvare. L'esito
                    // arriva dopo, da Transaction.updates.
                    call.resolve(["esito": "in_attesa"])
                @unknown default:
                    call.resolve(["esito": "annullato"])
                }
            } catch {
                call.reject("storekit: \(error.localizedDescription)")
            }
        }
    }

    /// Chiude le transazioni aperte e gia scadute (o revocate) di un prodotto.
    private func chiudiLeScadute(di id: String) async {
        for await esito in Transaction.unfinished {
            guard case .verified(let t) = esito, t.productID == id else { continue }
            let scaduta = (t.expirationDate.map { $0 < Date() } ?? false) || t.revocationDate != nil
            if scaduta { await t.finish() }
        }
    }

    /// ripristina() -> { jws: [String] }
    @objc func ripristina(_ call: CAPPluginCall) {
        Task {
            // Chiede ad Apple di riallineare le transazioni con l'Apple ID
            // corrente (serve su un dispositivo nuovo), poi legge cio che
            // vale adesso.
            try? await AppStore.sync()
            var lista: [[String: Any]] = []
            for await esito in Transaction.currentEntitlements {
                if case .verified(let t) = esito {
                    lista.append(self.descrivi(t, jws: esito.jwsRepresentation))
                }
            }
            call.resolve(["transazioni": lista])
        }
    }

    /// gestisci() -> apre il foglio Abbonamenti di Apple
    @objc func gestisci(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scena = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("nessuna scena")
                return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scena)
                call.resolve()
            } catch {
                call.reject("storekit: \(error.localizedDescription)")
            }
        }
    }

    /// finisci({ transactionId }) -> segna la transazione come consegnata
    /// (DOPO che il server l'ha registrata: prima, mai).
    @objc func finisci(_ call: CAPPluginCall) {
        guard let idStr = call.getString("transactionId"), let id = UInt64(idStr) else {
            call.reject("manca transactionId")
            return
        }
        Task {
            for await esito in Transaction.unfinished {
                if case .verified(let t) = esito, t.id == id {
                    await t.finish()
                }
            }
            call.resolve()
        }
    }
}
