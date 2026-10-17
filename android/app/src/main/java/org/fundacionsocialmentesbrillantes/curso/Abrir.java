package org.fundacionsocialmentesbrillantes.curso;

import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

/**
 * Abre una página del curso DENTRO de la app (la misma pantalla completa de
 * siempre), por ejemplo la lección del día al tocar el aviso o el widget.
 */
final class Abrir {
    private static final String LANZADOR = "com.google.androidbrowserhelper.trusted.LauncherActivity";

    private Abrir() {}

    /** /lecciones/N/ o, sin número, la pantalla «Hoy». */
    static String direccionLeccion(int numero) {
        String ruta = numero > 0 ? "/lecciones/" + numero + "/" : "/hoy/";
        return Datos.SITIO + ruta + "?" + Datos.ORIGEN;
    }

    static Intent intento(Context c, String direccion) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(direccion));
        i.setComponent(new ComponentName(c, LANZADOR));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return i;
    }

    /** Para el aviso y el widget: cada número de lección lleva su propio PendingIntent. */
    static PendingIntent pendiente(Context c, int codigo, String direccion) {
        return PendingIntent.getActivity(c, codigo, intento(c, direccion),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
