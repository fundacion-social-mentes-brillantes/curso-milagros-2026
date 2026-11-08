package org.fundacionsocialmentesbrillantes.curso;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Medianoche en Bogotá: el widget pasa a la lección del día nuevo. Si no hay
 * internet, usa la que el servidor dejó lista ayer para después de medianoche.
 */
public class MedianocheReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        final PendingResult fin = goAsync();
        new Thread(() -> {
            try {
                try {
                    Servidor.refrescar(c);
                } catch (Exception sinInternet) {
                    // Sin respuesta a medianoche (sin señal, o el servidor dormido):
                    // se vuelve a preguntar apenas se pueda. Mientras tanto el
                    // widget no muestra un número del que no esté seguro.
                    Refresco.pronto(c);
                }
                LeccionWidget.pintarTodos(c);
            } finally {
                Programador.programarMedianoche(c);
                fin.finish();
            }
        }).start();
    }
}
