package org.fundacionsocialmentesbrillantes.curso;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Suena la alarma del recordatorio: pregunta la lección del día (si hay
 * internet), muestra el aviso, actualiza el widget y deja puesta la de mañana.
 */
public class RecordatorioReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        final PendingResult fin = goAsync();
        new Thread(() -> {
            try {
                try {
                    Servidor.refrescar(c);
                } catch (Exception sinInternet) {
                    // Se avisa con lo último que se sabía: el aviso nunca se pierde.
                }
                Programador.avisar(c);
                LeccionWidget.pintarTodos(c);
            } finally {
                Programador.programarRecordatorio(c);
                fin.finish();
            }
        }).start();
    }
}
