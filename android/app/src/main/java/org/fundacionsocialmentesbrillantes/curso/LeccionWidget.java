package org.fundacionsocialmentesbrillantes.curso;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/**
 * El widget «Lección de hoy»: número e idea de la lección del día de la
 * persona. Al tocarlo se abre esa lección. Cambia solo a medianoche de Bogotá
 * (MedianocheReceiver) y cada vez que suena el recordatorio.
 */
public class LeccionWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager am, int[] ids) {
        final Context c = context.getApplicationContext();
        pintarTodos(c);
        // Y de paso pregunta al servidor, por si cambió algo desde la última vez.
        if (!Datos.vinculada(c)) return;
        final PendingResult fin = goAsync();
        new Thread(() -> {
            try {
                Servidor.refrescar(c);
                pintarTodos(c);
            } catch (Exception sinInternet) {
                // Queda lo último que se sabía.
            } finally {
                fin.finish();
            }
        }).start();
    }

    @Override
    public void onEnabled(Context context) {
        Programador.programarMedianoche(context.getApplicationContext());
    }

    static void pintarTodos(Context c) {
        AppWidgetManager am = AppWidgetManager.getInstance(c);
        int[] ids = am.getAppWidgetIds(new ComponentName(c, LeccionWidget.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews v = vista(c);
        for (int id : ids) am.updateAppWidget(id, v);
    }

    private static RemoteViews vista(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_leccion);
        Datos.Leccion l = Datos.vinculada(c) ? Datos.leccionAhora(c) : null;
        if (l == null) {
            v.setTextViewText(R.id.w_numero, "");
            v.setViewVisibility(R.id.w_numero, View.GONE);
            v.setTextViewText(R.id.w_idea, Datos.vinculada(c)
                    ? "Toca para ver tu lección de hoy."
                    : "Para ver aquí tu lección: en la app, Ajustes → Recordatorio y widget.");
            v.setViewVisibility(R.id.w_hecha, View.GONE);
            v.setOnClickPendingIntent(R.id.w_raiz, Abrir.pendiente(c, 200,
                    Datos.vinculada(c) ? Abrir.direccionLeccion(0) : Datos.SITIO + "/ajustes/?" + Datos.ORIGEN));
            return v;
        }
        v.setViewVisibility(R.id.w_numero, View.VISIBLE);
        v.setTextViewText(R.id.w_numero, String.valueOf(l.numero));
        v.setTextViewText(R.id.w_idea, l.idea.isEmpty() ? "Tu lección de hoy te espera." : l.idea);
        v.setViewVisibility(R.id.w_hecha, l.hecha ? View.VISIBLE : View.GONE);
        v.setOnClickPendingIntent(R.id.w_raiz, Abrir.pendiente(c, 300 + l.numero, Abrir.direccionLeccion(l.numero)));
        return v;
    }
}
