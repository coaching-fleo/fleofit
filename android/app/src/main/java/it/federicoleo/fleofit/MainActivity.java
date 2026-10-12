package it.federicoleo.fleofit;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // I plugin DELL'APP (non i pacchetti npm, che Capacitor trova da sé) si
        // registrano qui, PRIMA di super.onCreate: dopo, il bridge è già nato e
        // la pagina non li vede. Il gemello iOS è FleoBridgeViewController.
        registerPlugin(LettoreTestoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
