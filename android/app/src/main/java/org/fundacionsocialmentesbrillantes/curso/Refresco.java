package org.fundacionsocialmentesbrillantes.curso;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/**
 * Que el widget y el recordatorio no se queden con una lección vieja.
 *
 * Antes la app solo preguntaba al servidor a medianoche y al sonar el
 * recordatorio. Si en ese instante no había internet (o el ahorro de batería no
 * la dejaba salir), se quedaba con lo de ayer: el widget mostraba una lección ya
 * hecha, al tocarlo se veía dorada y parecía que la de hoy ya estaba (probado en
 * el emulador el 8-nov-2026: con la cuenta en la 4, el aviso decía «Lección 2»).
 *
 * Ahora Android (WorkManager) vuelve a preguntar cada hora cuando hay internet,
 * y una vez más apenas vuelva la conexión si la pregunta de medianoche o del
 * recordatorio falló. WorkManager sobrevive a reinicios y respeta la batería.
 */
final class Refresco {
    private static final String CADA_HORA = "refresco-cada-hora";
    private static final String PRONTO = "refresco-pronto";

    private Refresco() {}

    private static Constraints conInternet() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    /** Pone (o quita, si la app no está vinculada) la pregunta de cada hora. */
    static void programar(Context c) {
        WorkManager wm = WorkManager.getInstance(c);
        if (!Datos.vinculada(c)) {
            wm.cancelUniqueWork(CADA_HORA);
            return;
        }
        PeriodicWorkRequest cada = new PeriodicWorkRequest.Builder(Trabajo.class, 1, TimeUnit.HOURS)
                .setConstraints(conInternet())
                .build();
        wm.enqueueUniquePeriodicWork(CADA_HORA, ExistingPeriodicWorkPolicy.KEEP, cada);
    }

    /** Una pregunta extra apenas haya internet (si falla, reintenta con calma). */
    static void pronto(Context c) {
        if (!Datos.vinculada(c)) return;
        OneTimeWorkRequest una = new OneTimeWorkRequest.Builder(Trabajo.class)
                .setConstraints(conInternet())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build();
        WorkManager.getInstance(c).enqueueUniqueWork(PRONTO, ExistingWorkPolicy.REPLACE, una);
    }

    /** Lo que hace Android en segundo plano: preguntar y repintar el widget. */
    public static class Trabajo extends Worker {
        public Trabajo(@NonNull Context context, @NonNull WorkerParameters params) {
            super(context, params);
        }

        @NonNull
        @Override
        public Result doWork() {
            Context c = getApplicationContext();
            if (!Datos.vinculada(c)) return Result.success();
            try {
                // Aquí sí se puede esperar al servidor dormido (no hay un aviso esperando).
                Servidor.refrescar(c, true);
                LeccionWidget.pintarTodos(c);
                return Result.success();
            } catch (Servidor.SinVincular desvinculada) {
                LeccionWidget.pintarTodos(c);
                return Result.success();
            } catch (Exception sinRespuesta) {
                return Result.retry();
            }
        }
    }
}
