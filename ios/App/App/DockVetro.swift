import UIKit
import Capacitor

/**
 * IL VETRO VERO DEL DOCK (31 agosto 2026, giro 1).
 *
 * Il dock dentro l'app iOS deve essere vetro di iOS 26 — quello che
 * rifrange e illumina cio che gli passa dietro — non l'imitazione web
 * (sfocatura + saturazione) che resta giusta per Safari e per il sito.
 *
 * Come funziona: il dock RESTA quello web (stesse voci, stessi tocchi,
 * stessa geometria — il contratto non si sposta di un millimetro). Da qui
 * si aggiunge solo una LASTRA: una UIVisualEffectView col vetro di iOS 26,
 * appoggiata sopra la WebView esattamente dove sta la pillola. Il web,
 * quando la lastra c'e, spegne la sua finta sfocatura (classe
 * `jm-dock-nativo` in tab-bar.tsx) e le dice dove stare via questo plugin.
 *
 * La lastra NON intercetta tocchi (isUserInteractionEnabled = false):
 * ogni tocco attraversa e arriva ai tasti web sotto. Percio navigazione,
 * bersagli 44x44 e accessibilita restano quelli di sempre.
 *
 * Stile `.clear` e non `.regular`: le icone e le scritte del dock stanno
 * SOTTO la lastra (vivono nella pagina), e il vetro regolare le
 * sfocherebbe. Il clear rifrange ai bordi e lascia leggere il centro.
 * Se sul telefono le icone risultassero impastate, il giro dopo si passa
 * alle icone sopra il vetro — e scritto nel piano, non e un imprevisto.
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

    /// La lastra della pillola. Una sola; si crea al primo `sincronizza`.
    private var lastra: UIVisualEffectView?

    @objc func disponibile(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            call.resolve(["vetro": true])
        } else {
            call.resolve(["vetro": false])
        }
    }

    /**
     * Posa (o sposta) la lastra. Le misure arrivano dal web in pixel CSS,
     * che dentro WKWebView coincidono coi punti: nessuna conversione.
     * `modo` ("light"/"dark") segue il tema DELL'APP, non quello del
     * sistema: chi tiene il tema scuro col telefono chiaro deve avere il
     * vetro scuro.
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
        guard larghezza > 0, altezza > 0 else {
            call.resolve()
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, let webView = self.bridge?.webView else { return }
            let cornice = CGRect(x: x, y: y, width: larghezza, height: altezza)
            let v = self.lastra ?? self.creaLastra()
            if v.superview !== webView {
                // Dentro la webview (non nella sua scrollView): resta ferma
                // sullo schermo come il dock, e sta sopra la pagina.
                webView.addSubview(v)
            }
            v.frame = cornice
            v.overrideUserInterfaceStyle = modo == "light" ? .light : .dark
            v.isHidden = false
        }
        call.resolve()
    }

    /// Via la lastra (un foglio copre il dock, o il dock e smontato).
    /// Il web, nello stesso momento, riaccende la sua imitazione.
    @objc func nascondi(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.lastra?.isHidden = true
        }
        call.resolve()
    }

    @available(iOS 26.0, *)
    private func creaLastra() -> UIVisualEffectView {
        let vetro = UIGlassEffect(style: .clear)
        let v = UIVisualEffectView(effect: vetro)
        v.isUserInteractionEnabled = false
        // La pillola e una capsula (raggio = meta altezza). Se questa riga
        // non compila sul tuo Xcode, sostituiscila con:
        //   v.clipsToBounds = true  (e il raggio nel sincronizza)
        // e dimmelo: vuol dire che l'API dei bordi e diversa dalla mia.
        v.cornerConfiguration = .capsule()
        // Si tiene il riferimento: UNA lastra sola, riusata a ogni
        // sincronizza. Senza questa riga ogni chiamata ne impilerebbe
        // una nuova sopra la precedente.
        lastra = v
        return v
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
