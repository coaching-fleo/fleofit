package it.federicoleo.fleofit;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * «Da un testo scritto», fase 3 (12/10/2026): la FOTO di un workout letta con
 * ML Kit, sul telefono. È il gemello di ios/App/App/LettoreTesto.swift, con lo
 * stesso nome, lo stesso metodo e la stessa risposta, così il JavaScript
 * (src/lib/lettoreTesto.js) non sa quale dei due sta usando.
 *
 * Niente rete e niente IA generativa: il modello è IMPACCHETTATO nell'app
 * (`com.google.mlkit:text-recognition`, qualche MB per architettura), non
 * scaricato da Play Services al primo uso — un primo uso offline in palestra
 * fallirebbe con «modello in download».
 *
 * ⚠️ È un plugin DELL'APP: lo registra MainActivity, PRIMA di super.onCreate.
 * ⚠️ `parole` (il gergo da proteggere) qui si ignora: ML Kit non ha un
 * vocabolario personalizzato. Non serve quanto su iOS, perché ML Kit non
 * corregge le parole in base alla lingua.
 */
@CapacitorPlugin(name = "LettoreTesto")
public class LettoreTestoPlugin extends Plugin {

    private TextRecognizer riconoscitore;

    private TextRecognizer riconoscitore() {
        if (riconoscitore == null) {
            riconoscitore = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        }
        return riconoscitore;
    }

    /** `{ base64 }` → `{ righe: [{ testo, x, y, w, h }] }`, coordinate in frazioni, origine in alto. */
    @PluginMethod
    public void leggi(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null) {
            call.reject("Immagine non leggibile");
            return;
        }
        Bitmap immagine;
        try {
            byte[] dati = Base64.decode(base64, Base64.DEFAULT);
            immagine = BitmapFactory.decodeByteArray(dati, 0, dati.length);
        } catch (IllegalArgumentException e) {
            immagine = null;
        }
        if (immagine == null) {
            call.reject("Immagine non leggibile");
            return;
        }

        final double larghezza = immagine.getWidth();
        final double altezza = immagine.getHeight();
        // Rotazione 0: l'immagine arriva da un canvas, che l'ha già raddrizzata.
        riconoscitore()
            .process(InputImage.fromBitmap(immagine, 0))
            .addOnSuccessListener(testo -> {
                JSArray righe = new JSArray();
                // Le RIGHE e non i blocchi: un blocco di ML Kit può tenere insieme
                // due colonne vicine, ed è proprio quello che testoDaFoto.js deve
                // poter separare.
                for (Text.TextBlock blocco : testo.getTextBlocks()) {
                    for (Text.Line riga : blocco.getLines()) {
                        Rect r = riga.getBoundingBox();
                        if (r == null) continue;
                        JSObject o = new JSObject();
                        o.put("testo", riga.getText());
                        o.put("x", r.left / larghezza);
                        o.put("y", r.top / altezza);
                        o.put("w", r.width() / larghezza);
                        o.put("h", r.height() / altezza);
                        righe.put(o);
                    }
                }
                JSObject risposta = new JSObject();
                risposta.put("righe", righe);
                call.resolve(risposta);
            })
            .addOnFailureListener(e -> call.reject(e.getMessage() != null ? e.getMessage() : "Lettura non riuscita"));
    }

    @Override
    protected void handleOnDestroy() {
        if (riconoscitore != null) riconoscitore.close();
        super.handleOnDestroy();
    }
}
