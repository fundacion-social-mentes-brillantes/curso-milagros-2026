package org.fundacionsocialmentesbrillantes.curso;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

/**
 * Que el widget y el recordatorio no se queden con una lección vieja.
 *
 * Antes la app solo preguntaba al servidor a medianoche y al sonar el
 * recordatorio. Si en ese instante no había internet (o el ahorro de batería no
 * la dejaba salir), se quedaba con lo de ayer: el widget mostraba una lección ya
 * hecha, al tocarlo se veía dorada y parecía que la de hoy ya estaba (probado en
 * el emulador el 8-nov-2026: con la cuenta en la 4, el aviso decía «Lección 2»).
 *
 * Ahora Android (JobScheduler, que viene con el sistema) vuelve a preguntar cada
 * hora cuando hay internet, y una vez más apenas vuelva la conexión si la
 * pregunta de medianoche o del recordatorio falló. Sobrevive a reinicios.
 *
 * Primero se probó con WorkManager, pero su base de datos interna (Room) no
 * sobrevive al compactador de la versión final (R8): la app se cerraba al
 * abrir. JobScheduler no necesita nada de eso.
 */
public class Refresco extends JobService {
    private static final int CADA_HORA = 4101;
    private static final int PRONTO = 4102;

    private static JobScheduler planificador(Context c) {
        return (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
    }

    /*
     * Programar es un extra: si Android lo rechaza por cualquier motivo (un
     * permiso, un límite del fabricante), la app sigue igual y no se cierra.
     * Ya pasó en la prueba: sin ACCESS_NETWORK_STATE, la app se caía al abrir.
     */

    /** Pone (o quita, si la app no está vinculada) la pregunta de cada hora. */
    static void programar(Context c) {
        try {
            JobScheduler js = planificador(c);
            if (js == null) return;
            if (!Datos.vinculada(c)) {
                js.cancel(CADA_HORA);
                return;
            }
            if (js.getPendingJob(CADA_HORA) != null) return; // ya está puesta
            js.schedule(new JobInfo.Builder(CADA_HORA, new ComponentName(c, Refresco.class))
                    .setPeriodic(60 * 60 * 1000L)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPersisted(true)
                    .build());
        } catch (RuntimeException rechazado) {
            // Sin pregunta de cada hora: quedan la de medianoche y la del recordatorio.
        }
    }

    /** Una pregunta extra apenas haya internet (si falla, reintenta con calma). */
    static void pronto(Context c) {
        try {
            JobScheduler js = planificador(c);
            if (js == null || !Datos.vinculada(c)) return;
            js.schedule(new JobInfo.Builder(PRONTO, new ComponentName(c, Refresco.class))
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setBackoffCriteria(60 * 1000L, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                    .setPersisted(true)
                    .build());
        } catch (RuntimeException rechazado) {
            // Se queda con lo que sabía; el widget no muestra números dudosos.
        }
    }

    @Override
    public boolean onStartJob(final JobParameters params) {
        final Context c = getApplicationContext();
        new Thread(() -> {
            boolean otraVez = false;
            try {
                // Aquí sí se puede esperar al servidor dormido (no hay un aviso esperando).
                if (Datos.vinculada(c)) Servidor.refrescar(c, true);
            } catch (Servidor.SinVincular desvinculada) {
                // Ya no está vinculada: el widget lo dirá al repintarse.
            } catch (Exception sinRespuesta) {
                // La de cada hora vuelve a la hora siguiente; la «pronto» se reintenta.
                otraVez = params.getJobId() == PRONTO;
            }
            LeccionWidget.pintarTodos(c);
            jobFinished(params, otraVez);
        }).start();
        return true; // el trabajo sigue en el hilo de arriba
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true; // si Android lo corta (por ejemplo, se fue la señal), que lo repita
    }
}
