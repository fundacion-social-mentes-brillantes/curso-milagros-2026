package org.fundacionsocialmentesbrillantes.curso;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.util.Calendar;

/**
 * Las dos alarmas de la app y el aviso del recordatorio.
 *
 *  - El RECORDATORIO, cada día a la hora que eligió la persona (hora del
 *    celular). Alarma EXACTA del sistema, que suena aunque el celular esté en
 *    reposo y aunque nadie abra la app. Android 12+ pide un permiso aparte
 *    («Alarmas y recordatorios»); sin él se programa igual, pero Android puede
 *    retrasarla unos minutos.
 *  - La MEDIANOCHE de Bogotá, para que el widget cambie de lección solo.
 *
 * Android olvida las alarmas al reiniciar el celular o actualizar la app: las
 * vuelve a poner ArranqueReceiver.
 */
final class Programador {
    static final String CANAL = "recordatorio";
    private static final int ID_AVISO = 1;

    private Programador() {}

    static void reprogramarTodo(Context c) {
        programarRecordatorio(c);
        programarMedianoche(c);
    }

    static boolean puedeExacta(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = c.getSystemService(AlarmManager.class);
        return am != null && am.canScheduleExactAlarms();
    }

    // ----------------------------------------------------------- recordatorio
    static void programarRecordatorio(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        PendingIntent pi = pendiente(c, RecordatorioReceiver.class, 10);
        am.cancel(pi);
        if (!Datos.recordatorioActivo(c)) return;

        int minuto = Datos.minutoRecordatorio(c);
        Calendar cuando = Calendar.getInstance(); // hora del celular
        cuando.set(Calendar.HOUR_OF_DAY, minuto / 60);
        cuando.set(Calendar.MINUTE, minuto % 60);
        cuando.set(Calendar.SECOND, 0);
        cuando.set(Calendar.MILLISECOND, 0);
        if (cuando.getTimeInMillis() <= System.currentTimeMillis() + 1000) cuando.add(Calendar.DAY_OF_YEAR, 1);
        poner(c, am, cuando.getTimeInMillis(), pi);
    }

    // -------------------------------------------------------------- medianoche
    static void programarMedianoche(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        PendingIntent pi = pendiente(c, MedianocheReceiver.class, 20);
        am.cancel(pi);
        if (!Datos.vinculada(c)) return;

        Calendar cuando = Calendar.getInstance(Datos.BOGOTA);
        cuando.add(Calendar.DAY_OF_YEAR, 1);
        cuando.set(Calendar.HOUR_OF_DAY, 0);
        cuando.set(Calendar.MINUTE, 0);
        cuando.set(Calendar.SECOND, 20); // un respiro para que el servidor ya esté en el día nuevo
        cuando.set(Calendar.MILLISECOND, 0);
        poner(c, am, cuando.getTimeInMillis(), pi);
    }

    private static void poner(Context c, AlarmManager am, long cuando, PendingIntent pi) {
        if (puedeExacta(c)) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
        }
    }

    private static PendingIntent pendiente(Context c, Class<?> receptor, int codigo) {
        Intent i = new Intent(c, receptor);
        return PendingIntent.getBroadcast(c, codigo, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ------------------------------------------------------------------ aviso
    static void crearCanal(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel canal = new NotificationChannel(CANAL, "Recordatorio diario",
                NotificationManager.IMPORTANCE_HIGH);
        canal.setDescription("El aviso de cada día para hacer tu lección, a la hora que elegiste.");
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(canal);
    }

    static boolean puedeAvisar(Context c) {
        if (Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(c).areNotificationsEnabled();
    }

    /**
     * Muestra el aviso con la lección del día (la última que se sepa): el logo
     * del curso a la derecha y, al desplegarlo, la ilustración de la lección.
     * Se llama siempre desde un hilo aparte (baja la imagen).
     */
    static void avisar(Context c) {
        crearCanal(c);
        if (!puedeAvisar(c)) return;
        Datos.Leccion l = Datos.leccionAhora(c);
        String titulo;
        String texto;
        if (l == null) {
            titulo = "Tu lección de hoy te espera";
            texto = "Tómate un momento para tu práctica de hoy.";
        } else if (l.hecha) {
            titulo = "Lección " + l.numero + " · ya la hiciste hoy";
            texto = l.idea.isEmpty() ? "Vuelve un momento a su idea." : "Vuelve un momento a su idea: " + l.idea;
        } else {
            titulo = "Lección " + l.numero + " · tu práctica de hoy";
            texto = l.idea.isEmpty() ? "Tómate un momento para tu práctica de hoy." : l.idea;
        }
        int numero = l == null ? 0 : l.numero;
        Bitmap logo = BitmapFactory.decodeResource(c.getResources(), R.drawable.aviso_logo);
        Bitmap imagen = Servidor.imagenLeccion(numero);
        NotificationCompat.Style estilo = imagen == null
                ? new NotificationCompat.BigTextStyle().bigText(texto)
                : new NotificationCompat.BigPictureStyle()
                        .bigPicture(imagen)
                        .bigLargeIcon((Bitmap) null) // desplegado, la imagen ya lo dice todo
                        .setSummaryText(texto);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL)
                .setSmallIcon(R.drawable.ic_notificacion)
                .setLargeIcon(logo)
                .setColor(0xFFC49A52)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setStyle(estilo)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(Abrir.pendiente(c, 100 + numero, Abrir.direccionLeccion(numero)));
        try {
            NotificationManagerCompat.from(c).notify(ID_AVISO, b.build());
        } catch (SecurityException sinPermiso) {
            // Le quitaron el permiso justo ahora: no hay nada que hacer.
        }
    }
}
