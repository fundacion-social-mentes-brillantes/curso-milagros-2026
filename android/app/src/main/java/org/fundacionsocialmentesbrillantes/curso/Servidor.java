package org.fundacionsocialmentesbrillantes.curso;

import android.content.Context;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Las tres preguntas que la app le hace al servidor del curso
 * (api/src/functions/appandroid.js). Nunca desde el hilo principal.
 */
final class Servidor {
    private Servidor() {}

    /** El servidor ya no reconoce la llave (la desvincularon o se borró la cuenta). */
    static final class SinVincular extends Exception {}

    /** El código de Ajustes ya se usó o pasaron más de 15 minutos. */
    static final class CodigoVencido extends Exception {}

    /** Cambia el código de un solo uso por la llave de este celular. */
    static void canjear(Context c, String codigo, String celular) throws Exception {
        JSONObject cuerpo = new JSONObject().put("codigo", codigo).put("celular", celular);
        Respuesta r = pedir("POST", "/api/app/canjear", null, cuerpo.toString());
        if (r.estado == 410 || r.estado == 400) throw new CodigoVencido();
        if (r.estado != 200) throw new Exception("canjear: " + r.estado);
        JSONObject d = new JSONObject(r.texto);
        Datos.vincular(c, d.getString("llave"), d.optString("nombre", ""));
    }

    /** Pregunta la lección del día y la deja guardada. */
    static void refrescar(Context c) throws Exception {
        String llave = Datos.llave(c);
        if (llave == null) throw new SinVincular();
        Respuesta r = pedir("GET", "/api/app/hoy", llave, null);
        if (r.estado == 401) throw new SinVincular();
        if (r.estado != 200) throw new Exception("hoy: " + r.estado);
        Datos.guardarHoy(c, new JSONObject(r.texto));
    }

    static void desvincular(Context c) {
        String llave = Datos.llave(c);
        if (llave == null) return;
        try {
            pedir("DELETE", "/api/app/dispositivo", llave, null);
        } catch (Exception ignorado) {
            // Si no hay internet, igual se olvida en el celular.
        }
    }

    // ------------------------------------------------------------------
    private static final class Respuesta {
        final int estado;
        final String texto;

        Respuesta(int estado, String texto) {
            this.estado = estado;
            this.texto = texto;
        }
    }

    private static Respuesta pedir(String metodo, String ruta, String llave, String cuerpo) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(Datos.SITIO + ruta).openConnection();
        try {
            con.setRequestMethod(metodo);
            con.setConnectTimeout(8000);
            con.setReadTimeout(10000);
            con.setUseCaches(false);
            // Cabecera propia: Azure Static Web Apps pisa la de Authorization.
            if (llave != null) con.setRequestProperty("x-app-llave", llave);
            if (cuerpo != null) {
                con.setDoOutput(true);
                con.setRequestProperty("Content-Type", "application/json");
                try (OutputStream o = con.getOutputStream()) {
                    o.write(cuerpo.getBytes(StandardCharsets.UTF_8));
                }
            }
            int estado = con.getResponseCode();
            InputStream in = estado < 400 ? con.getInputStream() : con.getErrorStream();
            String texto = "";
            if (in != null) {
                try (InputStream i = in) {
                    ByteArrayOutputStream b = new ByteArrayOutputStream();
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = i.read(buf)) > 0) b.write(buf, 0, n);
                    texto = b.toString("UTF-8");
                }
            }
            return new Respuesta(estado, texto);
        } finally {
            con.disconnect();
        }
    }
}
