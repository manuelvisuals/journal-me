import UIKit
import Capacitor

/**
 * IL VETRO VERO DEL DOCK (31 agosto 2026; giro 2 il 1 settembre, dopo la
 * prova sul telefono di Manuel).
 *
 * Il dock dentro l'app iOS deve essere vetro di iOS 26 — quello che
 * rifrange e illumina cio che gli passa dietro — non l'imitazione web
 * (sfocatura + saturazione) che resta giusta per Safari e per il sito.
 *
 * Com'e fatto, dal basso verso l'alto (tutto dentro uno STRATO che non
 * intercetta tocchi, appoggiato sopra la WebView):
 *
 *   1. la LASTRA    UIGlassEffect a capsula, dove sta la pillola web;
 *   2. la LENTE     un secondo vetro, piu piccolo, sul tasto acceso —
 *                   viaggia da un tasto all'altro con una molla, come la
 *                   bolla del mockup approvato (variante A);
 *   3. il CONTENUTO icone, scritte e microfono, FOTOGRAFATI dal web
 *                   (canvas trasparente, vedi dock-vetro.ts) e posati
 *                   sopra il vetro.
 *
 * Perche la fotografia: il vetro sta sopra la pagina, e nel giro 1 le
 * icone — che sulla pagina vivono — uscivano rifratte, sdoppiate,
 * "dietro il vetro". I controlli di iOS mettono le scritte SOPRA il
 * vetro, mai sotto: qui si fa uguale. I tasti web restano al loro posto,
 * invisibili ma toccabili: il contratto del dock (voci, ordine,
 * microfono, bersagli 44x44) non si sposta dal web.
 *
 * Fuori da iOS 26 (`disponibile` risponde vetro:false) il web tiene la
 * sua imitazione: mai una pillola trasparente senza niente dietro.
 */
@objc(DockVetroPlugin)
public class DockVetroPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DockVetroPlugin"
    public let jsName = "DockVetro"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "disponibile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sincronizza", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "nascondi", returnType: CAPPluginReturnPromise),
    ]

    private var strato: UIView?
    private var lastra: UIVisualEffectView?
    private var lente: UIView?
    private var contenuto: UIImageView?
    /// La lente anima solo un VIAGGIO (da tasto a tasto, a strato gia
    /// visibile): comparire dal nulla o dopo un foglio non e un viaggio.
    private var lenteInPosa = false

    @objc func disponibile(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            call.resolve(["vetro": true])
        } else {
            call.resolve(["vetro": false])
        }
    }

    /**
     * Posa (o sposta) lastra, lente e contenuto. Le misure arrivano dal
     * web in pixel CSS, che dentro WKWebView coincidono coi punti.
     * `modo` ("light"/"dark") segue il tema DELL'APP, non il sistema.
     * `immagine` (png base64, con la sua `scala`) arriva solo quando la
     * foto e cambiata: assente, si tiene quella che c'e.
     */
    @objc func sincronizza(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            call.resolve()
            return
        }
        let x = call.getDouble("x") ?? 0
        let y = call.getDouble("y") ?? 0
        let larghezza = call.getDouble("larghezza") ?? 0
        let altezza = call.getDouble("altezza") ?? 0
        let modo = call.getString("modo") ?? "dark"
        let animato = call.getBool("animato") ?? true
        let lenteDati = call.getObject("lente")
        let immagine = call.getString("immagine")
        let scala = call.getDouble("scala") ?? 3
        guard larghezza > 0, altezza > 0 else {
            call.resolve()
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, let webView = self.bridge?.webView else { return }

            let strato = self.strato ?? self.creaStrato(dentro: webView)
            if strato.superview !== webView {
                webView.addSubview(strato)
            }
            webView.bringSubviewToFront(strato)
            strato.overrideUserInterfaceStyle = modo == "light" ? .light : .dark
            let eraNascosto = strato.isHidden
            strato.isHidden = false

            let cornice = CGRect(x: x, y: y, width: larghezza, height: altezza)
            self.posaLastra(cornice, in: strato)
            self.posaLente(
                lenteDati,
                colore: call.getObject("lenteColore"),
                in: strato,
                viaggia: animato && !eraNascosto
            )
            self.posaContenuto(immagine, scala: scala, cornice: cornice, in: strato)
        }
        call.resolve()
    }

    /// Via tutto (un foglio copre il dock, o il dock e smontato).
    /// Il web, nello stesso momento, riaccende la sua imitazione.
    @objc func nascondi(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.strato?.isHidden = true
            self?.lenteInPosa = false
        }
        call.resolve()
    }

    // MARK: - I pezzi

    @available(iOS 26.0, *)
    private func creaStrato(dentro webView: UIView) -> UIView {
        let v = UIView(frame: webView.bounds)
        v.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        v.isUserInteractionEnabled = false
        v.backgroundColor = .clear
        webView.addSubview(v)
        strato = v
        return v
    }

    @available(iOS 26.0, *)
    private func posaLastra(_ cornice: CGRect, in strato: UIView) {
        let v: UIVisualEffectView
        if let l = lastra {
            v = l
        } else {
            let vetro = UIGlassEffect(style: .clear)
            v = UIVisualEffectView(effect: vetro)
            v.isUserInteractionEnabled = false
            // La pillola e una capsula (raggio = meta altezza). Se questa
            // riga non compila sul tuo Xcode, sostituiscila con
            // clipsToBounds + layer.cornerRadius e dimmelo.
            v.cornerConfiguration = .capsule()
            strato.insertSubview(v, at: 0)
            lastra = v
        }
        v.frame = cornice
    }

    /**
     * La lente, dal 1 settembre (richiesta di Manuel con lo screenshot di
     * Instagram): non piu un secondo vetro con bordi — una CAPSULA PIENA e
     * morbida, il colore che ogni tema gia possiede per la sua lente
     * (`--color-glass-lens`), risolto dal web in numeri. Il vetro vero
     * resta alla lastra; la lente evidenzia, come su Instagram.
     */
    @available(iOS 26.0, *)
    private func posaLente(
        _ dati: JSObject?,
        colore: JSObject?,
        in strato: UIView,
        viaggia: Bool
    ) {
        guard let dati,
              let x = (dati["x"] as? NSNumber)?.doubleValue,
              let y = (dati["y"] as? NSNumber)?.doubleValue,
              let larghezza = (dati["larghezza"] as? NSNumber)?.doubleValue,
              let altezza = (dati["altezza"] as? NSNumber)?.doubleValue,
              larghezza > 0, altezza > 0
        else {
            // Nessun tasto acceso (Recap, Impostazioni): niente lente.
            lente?.isHidden = true
            lenteInPosa = false
            return
        }
        let cornice = CGRect(x: x, y: y, width: larghezza, height: altezza)
        let v: UIView
        if let l = lente {
            v = l
        } else {
            v = UIView()
            v.isUserInteractionEnabled = false
            strato.insertSubview(v, aboveSubview: lastra ?? strato.subviews[0])
            lente = v
        }
        if let c = colore,
           let r = (c["r"] as? NSNumber)?.doubleValue,
           let g = (c["g"] as? NSNumber)?.doubleValue,
           let b = (c["b"] as? NSNumber)?.doubleValue,
           let a = (c["a"] as? NSNumber)?.doubleValue {
            v.backgroundColor = UIColor(
                red: r / 255.0,
                green: g / 255.0,
                blue: b / 255.0,
                alpha: a
            )
        }
        v.layer.cornerRadius = cornice.height / 2
        // Confronto con mezzo punto di tolleranza: le misure arrivano dal
        // web con frazioni che ballano, e scambiare un ballo di 0,1px per
        // un viaggio (o per un frame nuovo da scrivere) ammazza la molla.
        let stessa =
            abs(v.frame.origin.x - cornice.origin.x) < 0.5 &&
            abs(v.frame.origin.y - cornice.origin.y) < 0.5 &&
            abs(v.frame.width - cornice.width) < 0.5 &&
            abs(v.frame.height - cornice.height) < 0.5
        let viaggioVero = viaggia && lenteInPosa && !v.isHidden && !stessa
        v.isHidden = false
        if viaggioVero {
            // La stessa pasta del viaggio web (460ms, coda morbida): e
            // quello che fa dire "liquido" — mockup variante A.
            UIView.animate(
                withDuration: 0.46,
                delay: 0,
                usingSpringWithDamping: 0.82,
                initialSpringVelocity: 0.2,
                options: [.beginFromCurrentState, .allowUserInteraction]
            ) {
                v.frame = cornice
            }
        } else if !stessa {
            // A pari misura non si tocca niente: riscrivere lo stesso frame
            // AMMAZZA l'animazione in corso (UIKit tiene il valore finale
            // come modello), ed era questo a far scattare la lente a meta
            // viaggio a ogni sincronizzazione di passaggio.
            v.frame = cornice
        }
        lenteInPosa = true
    }

    @available(iOS 26.0, *)
    private func posaContenuto(
        _ immagine: String?,
        scala: Double,
        cornice: CGRect,
        in strato: UIView
    ) {
        if let b64 = immagine,
           let dati = Data(base64Encoded: b64),
           let img = UIImage(data: dati, scale: CGFloat(scala)) {
            let v: UIImageView
            if let c = contenuto {
                v = c
            } else {
                v = UIImageView()
                v.isUserInteractionEnabled = false
                v.contentMode = .scaleToFill
                strato.addSubview(v)
                contenuto = v
            }
            v.image = img
        }
        contenuto?.frame = cornice
        // Il contenuto sta SEMPRE sopra la lente, in qualunque ordine i
        // pezzi siano nati.
        if let c = contenuto {
            strato.bringSubviewToFront(c)
        }
    }
}

/**
 * IL ROUTER DEL GUSCIO (1 settembre 2026, primo collaudo su device della
 * separazione sito/app del 31 agosto).
 *
 * Il router di serie di Capacitor serve OGNI indirizzo senza estensione
 * col file di radice (`/index.html`): va bene quando la radice E l'app.
 * Da quando la radice e il sito, `/index.html` nel pacchetto e solo un
 * salto verso `./app/` (scripts/ios-radice.mjs) — e col router di serie
 * quel salto riconsegna... la pagina che salta. Risultato visto sul
 * telefono di Manuel: schermo nero e "WebView loaded" stampato
 * all'infinito.
 *
 * Questo router serve a ogni indirizzo il SUO index.html (l'export
 * statico ne ha uno per pagina: /app/, /app/mese/, ...). Se il file non
 * esiste, si torna alla radice come faceva Capacitor: mai un errore dove
 * prima c'era una pagina.
 */
struct AppRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        let pathUrl = URL(fileURLWithPath: path)
        // Un file vero (js, css, immagini): si serve e basta.
        guard pathUrl.pathExtension.isEmpty else { return basePath + path }
        var pulito = path
        while pulito.hasSuffix("/") { pulito.removeLast() }
        if !pulito.isEmpty && pulito != "/" {
            let candidato = basePath + pulito + "/index.html"
            if FileManager.default.fileExists(atPath: candidato) {
                return candidato
            }
        }
        return basePath + "/index.html"
    }
}

/**
 * Il ponte che registra il plugin e monta il router qui sopra. Capacitor
 * carica da solo i plugin dei pacchetti npm; un plugin che vive DENTRO
 * l'app (questo file) va registrato a mano, e il posto e il viewDidLoad
 * del bridge. SceneDelegate monta questa classe al posto di
 * CAPBridgeViewController.
 */
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(DockVetroPlugin())
    }

    override open func router() -> Router {
        return AppRouter()
    }
}
