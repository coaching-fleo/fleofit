package it.federicoleo.fleofit;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Il codice d'invito che sopravvive all'installazione (16/11/2026).
 *
 * Il link del coach manda chi non ha l'app al Play Store con
 * `&referrer=invite%3D<codice>`; il Play Store riconsegna quel testo all'app
 * al primo avvio, ed è questo plugin a leggerlo (src/lib/referrerInvito.js).
 * Solo Android: su iOS non esiste, e il JS lo chiama con un `.catch`.
 *
 * Risponde sempre, anche quando non c'è niente: `{ referrer: "" }`. Un
 * Play Store assente (emulatore senza Play, sideload) non è un errore.
 */
@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

    @PluginMethod
    public void leggi(PluginCall call) {
        InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        try {
            client.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int codice) {
                    String referrer = "";
                    if (codice == InstallReferrerClient.InstallReferrerResponse.OK) {
                        try {
                            ReferrerDetails dettagli = client.getInstallReferrer();
                            if (dettagli.getInstallReferrer() != null) referrer = dettagli.getInstallReferrer();
                        } catch (Exception e) { /* resta vuoto */ }
                    }
                    try { client.endConnection(); } catch (Exception e) { /* niente */ }
                    JSObject r = new JSObject();
                    r.put("referrer", referrer);
                    call.resolve(r);
                }

                @Override
                public void onInstallReferrerServiceDisconnected() { /* la risposta è già partita o partirà */ }
            });
        } catch (Exception e) {
            JSObject r = new JSObject();
            r.put("referrer", "");
            call.resolve(r);
        }
    }
}
