package org.fundacionsocialmentesbrillantes.curso;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Lo que la app guarda en el celular: la llave que la vincula con la cuenta,
 * la hora del recordatorio y la última lección del día que contestó el servidor
 * (para que el widget y el aviso funcionen aunque no haya internet).
 */
final class Datos {
    static final String SITIO = "https://cursodemilagros.gimnasioemocionalmb.com";
    /** La web usa esto para saber que se abrió desde la app (src/lib/app-android.ts). */
    static final String ORIGEN = "origen=app-android";
    static final TimeZone BOGOTA = TimeZone.getTimeZone("America/Bogota");

    private static final String ARCHIVO = "curso";

    private Datos() {}

    private static SharedPreferences p(Context c) {
        return c.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE);
    }

    // ------------------------------------------------------------ vínculo
    static String llave(Context c) { return p(c).getString("llave", null); }
    static String nombre(Context c) { return p(c).getString("nombre", ""); }
    static boolean vinculada(Context c) { return llave(c) != null; }

    static void vincular(Context c, String llave, String nombre) {
        p(c).edit().putString("llave", llave).putString("nombre", nombre).apply();
    }

    static void desvincular(Context c) {
        p(c).edit().remove("llave").remove("nombre").remove("hoy").apply();
    }

    // ------------------------------------------------------- recordatorio
    static boolean recordatorioActivo(Context c) { return p(c).getBoolean("activo", false); }
    /** Minuto del día, hora del celular. 7:00 a. m. si nunca se eligió. */
    static int minutoRecordatorio(Context c) { return p(c).getInt("minuto", 7 * 60); }

    static void guardarRecordatorio(Context c, boolean activo, int minuto) {
        p(c).edit().putBoolean("activo", activo).putInt("minuto", minuto).apply();
    }

    // ------------------------------------------------- lección del día
    /** Respuesta de /api/app/hoy tal cual, o null. */
    static JSONObject hoyGuardado(Context c) {
        String s = p(c).getString("hoy", null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static void guardarHoy(Context c, JSONObject hoy) {
        p(c).edit().putString("hoy", hoy.toString()).apply();
    }

    /** Fecha de hoy en Colombia, igual que el servidor (AAAA-MM-DD). */
    static String fechaBogota() {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(BOGOTA);
        return f.format(new Date());
    }

    /**
     * La lección que toca mostrar AHORA: la de hoy si la respuesta es de hoy;
     * si es de un día anterior (pasó la medianoche sin internet), la que el
     * servidor dejó lista para después de la medianoche.
     * Devuelve {numero, idea, hecha} o null si nunca se ha sabido nada.
     */
    static Leccion leccionAhora(Context c) {
        JSONObject r = hoyGuardado(c);
        if (r == null) return null;
        try {
            boolean deHoy = fechaBogota().equals(r.optString("fecha"));
            JSONObject l = deHoy ? r.getJSONObject("hoy") : r.getJSONObject("manana");
            return new Leccion(l.getInt("numero"), l.optString("idea", ""), deHoy && l.optBoolean("hecha"));
        } catch (Exception e) {
            return null;
        }
    }

    static final class Leccion {
        final int numero;
        final String idea;
        final boolean hecha;

        Leccion(int numero, String idea, boolean hecha) {
            this.numero = numero;
            this.idea = idea;
            this.hecha = hecha;
        }
    }
}
