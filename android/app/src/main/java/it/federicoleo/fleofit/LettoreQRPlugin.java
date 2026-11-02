package it.federicoleo.fleofit;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

/**
 * Collegare la TV con il QR (30/10/2026): legge il codice `fleofit://tv/<codice>`
 * con lo scanner di Google Play Services. Gemello di ios/App/App/LettoreQR.swift:
 * stesso nome, stesso metodo, stessa risposta (src/lib/lettoreQR.js).
 *
 * Lo scanner ha la sua schermata e la sua fotocamera: l'app NON ha il permesso
 * CAMERA e non ne ha bisogno. Quindi qui il rifiuto «permesso» non esiste;
 * un guasto dello scanner (es. modulo da scaricare) passa come messaggio e il
 * JS lo trasforma in «non_disponibile».
 */
@CapacitorPlugin(name = "LettoreQR")
public class LettoreQRPlugin extends Plugin {

    @PluginMethod
    public void leggi(PluginCall call) {
        GmsBarcodeScannerOptions opzioni = new GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build();
        GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(getActivity(), opzioni);
        scanner
            .startScan()
            .addOnSuccessListener(barcode -> {
                JSObject r = new JSObject();
                r.put("valore", barcode.getRawValue());
                call.resolve(r);
            })
            .addOnCanceledListener(() -> {
                JSObject r = new JSObject();
                r.put("annullato", true);
                call.resolve(r);
            })
            .addOnFailureListener(e -> call.reject(e.getMessage()));
    }

    /** Su Android non c'è un permesso da riaprire: niente da fare. */
    @PluginMethod
    public void impostazioni(PluginCall call) {
        call.resolve();
    }
}
