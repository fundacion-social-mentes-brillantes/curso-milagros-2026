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
                    // Datos.leccionAhora ya cambia sola a la lección de «mañana».
                }
                LeccionWidget.pintarTodos(c);
            } finally {
                Programador.programarMedianoche(c);
                fin.finish();
            }
        }).start();
    }
}
