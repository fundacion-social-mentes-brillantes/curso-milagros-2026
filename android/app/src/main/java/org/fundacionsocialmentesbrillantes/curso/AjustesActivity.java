package org.fundacionsocialmentesbrillantes.curso;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.TimePickerDialog;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Locale;

/**
 * «Recordatorio y widget»: la única pantalla nativa de la app.
 *
 * Se abre desde la web (Ajustes → «Elegir la hora y poner el widget»), que le
 * pasa un código de un solo uso para vincular el celular con la cuenta; o
 * desde el atajo del icono, para cambiar la hora. Aquí se elige la hora del
 * recordatorio, se dan los permisos que Android pide y se pone el widget.
 */
public class AjustesActivity extends Activity {
    private static final int PEDIR_AVISOS = 7;

    private TextView estado, hoy, avisoPermiso, desvincular;
    private Switch activo;
    private Button hora, permiso, probar, widget, volver;
    private boolean pintando;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        setContentView(R.layout.ajustes);
        estado = findViewById(R.id.a_estado);
        hoy = findViewById(R.id.a_hoy);
        avisoPermiso = findViewById(R.id.a_aviso_permiso);
        desvincular = findViewById(R.id.a_desvincular);
        activo = findViewById(R.id.a_activo);
        hora = findViewById(R.id.a_hora);
        permiso = findViewById(R.id.a_permiso);
        probar = findViewById(R.id.a_probar);
        widget = findViewById(R.id.a_widget);
        volver = findViewById(R.id.a_volver);

        Programador.crearCanal(this);

        activo.setOnCheckedChangeListener((b, encendido) -> {
            if (pintando) return;
            Datos.guardarRecordatorio(this, encendido, Datos.minutoRecordatorio(this));
            Programador.programarRecordatorio(this);
            if (encendido && Build.VERSION.SDK_INT >= 33 && !Programador.puedeAvisar(this)) {
                requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, PEDIR_AVISOS);
            }
            pintar();
        });
        hora.setOnClickListener(v -> elegirHora());
        permiso.setOnClickListener(v -> arreglarPermiso());
        probar.setOnClickListener(v -> probarAviso());
        widget.setOnClickListener(v -> ponerWidget());
        volver.setOnClickListener(v -> {
            Datos.Leccion l = Datos.leccionAhora(this);
            startActivity(Abrir.intento(this, Abrir.direccionLeccion(l == null ? 0 : l.numero)));
            finish();
        });
        desvincular.setOnClickListener(v -> confirmarDesvincular());

        atender(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        atender(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Al volver de los ajustes de Android el permiso pudo cambiar: si ahora
        // hay alarmas exactas, la de mañana pasa a ser exacta.
        Programador.reprogramarTodo(this);
        pintar();
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permisos, int[] resultados) {
        super.onRequestPermissionsResult(codigo, permisos, resultados);
        pintar();
    }

    // ------------------------------------------------------------- vincular
    private void atender(Intent intent) {
        Uri datos = intent == null ? null : intent.getData();
        String codigo = datos == null ? null : datos.getQueryParameter("codigo");
        if (codigo != null && !codigo.isEmpty()) {
            estado.setText("Vinculando este celular con tu cuenta…");
            enSegundoPlano(() -> {
                try {
                    Servidor.canjear(this, codigo, Build.MANUFACTURER + " " + Build.MODEL);
                    try {
                        Servidor.refrescar(this);
                    } catch (Exception ignorado) {
                        // Se vuelve a intentar con el widget o el recordatorio.
                    }
                    Programador.reprogramarTodo(this);
                    LeccionWidget.pintarTodos(this);
                    runOnUiThread(this::pintar);
                } catch (Servidor.CodigoVencido e) {
                    runOnUiThread(() -> estado.setText(Datos.vinculada(this)
                            ? "Este celular ya está vinculado."
                            : "Ese enlace ya se usó o venció. En la app, entra a Ajustes y toca otra vez «Elegir la hora y poner el widget»."));
                } catch (Exception e) {
                    runOnUiThread(() -> estado.setText("No hay conexión con el curso. Revisa el internet y vuelve a intentarlo desde Ajustes."));
                }
            });
        } else if (Datos.vinculada(this)) {
            enSegundoPlano(() -> {
                try {
                    Servidor.refrescar(this);
                    LeccionWidget.pintarTodos(this);
                    runOnUiThread(this::pintar);
                } catch (Servidor.SinVincular e) {
                    Datos.desvincular(this);
                    runOnUiThread(this::pintar);
                } catch (Exception sinInternet) {
                    // Queda lo último que se sabía.
                }
            });
        }
    }

    // ---------------------------------------------------------------- pintar
    private void pintar() {
        pintando = true;
        boolean vinculada = Datos.vinculada(this);
        String nombre = Datos.nombre(this);
        estado.setText(vinculada
                ? "Este celular está vinculado con tu cuenta" + (nombre.isEmpty() ? "." : ", " + nombre + ".")
                : "Para que el recordatorio y el widget muestren TU lección, abre el curso, entra a Ajustes y toca «Elegir la hora y poner el widget».");

        Datos.Leccion l = vinculada ? Datos.leccionAhora(this) : null;
        findViewById(R.id.a_hoy_caja).setVisibility(l == null ? View.GONE : View.VISIBLE);
        if (l != null) {
            hoy.setText("Lección " + l.numero + (l.hecha ? " · ✓ hecha" : "")
                    + (l.idea.isEmpty() ? "" : "\n" + l.idea));
        }

        boolean encendido = Datos.recordatorioActivo(this);
        activo.setChecked(encendido);
        hora.setText("Todos los días a las " + horaBonita(Datos.minutoRecordatorio(this)));
        hora.setEnabled(true);

        // Lo que falta para que el aviso llegue sí o sí, en orden de importancia.
        String falta = null;
        String arreglo = null;
        if (encendido && !Programador.puedeAvisar(this)) {
            falta = "Android no deja que la app te muestre avisos.";
            arreglo = "Permitir los avisos";
        } else if (encendido && !Programador.puedeExacta(this)) {
            falta = "Para que llegue justo a tu hora, Android pide permitir «Alarmas y recordatorios». Sin eso puede llegar unos minutos tarde.";
            arreglo = "Permitir la hora exacta";
        }
        avisoPermiso.setVisibility(falta == null ? View.GONE : View.VISIBLE);
        permiso.setVisibility(falta == null ? View.GONE : View.VISIBLE);
        if (falta != null) {
            avisoPermiso.setText(falta);
            permiso.setText(arreglo);
        }

        widget.setEnabled(true);
        desvincular.setVisibility(vinculada ? View.VISIBLE : View.GONE);
        pintando = false;
    }

    private static String horaBonita(int minuto) {
        int h = minuto / 60;
        int m = minuto % 60;
        int h12 = h % 12 == 0 ? 12 : h % 12;
        return String.format(Locale.US, "%d:%02d %s", h12, m, h < 12 ? "a. m." : "p. m.");
    }

    // --------------------------------------------------------------- acciones
    private void elegirHora() {
        int minuto = Datos.minutoRecordatorio(this);
        new TimePickerDialog(this, (v, h, m) -> {
            Datos.guardarRecordatorio(this, true, h * 60 + m);
            Programador.programarRecordatorio(this);
            if (Build.VERSION.SDK_INT >= 33 && !Programador.puedeAvisar(this)) {
                requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, PEDIR_AVISOS);
            }
            pintar();
            Toast.makeText(this, "Listo: cada día a las " + horaBonita(h * 60 + m), Toast.LENGTH_SHORT).show();
        }, minuto / 60, minuto % 60, false).show();
    }

    private void arreglarPermiso() {
        if (!Programador.puedeAvisar(this)) {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    && shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, PEDIR_AVISOS);
                return;
            }
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            abrirAjustesDeAndroid(i);
        } else if (Build.VERSION.SDK_INT >= 31 && !Programador.puedeExacta(this)) {
            abrirAjustesDeAndroid(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + getPackageName())));
        }
    }

    private void abrirAjustesDeAndroid(Intent i) {
        try {
            startActivity(i);
        } catch (Exception e) {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getPackageName())));
        }
    }

    private void probarAviso() {
        if (!Programador.puedeAvisar(this)) {
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, PEDIR_AVISOS);
            } else {
                arreglarPermiso();
            }
            return;
        }
        enSegundoPlano(() -> {
            try {
                Servidor.refrescar(this);
            } catch (Exception ignorado) {
                // Con lo último que se sabía.
            }
            Programador.avisar(this);
            runOnUiThread(() -> {
                pintar();
                Toast.makeText(this, "Listo: así te llegará cada día.", Toast.LENGTH_SHORT).show();
            });
        });
    }

    private void ponerWidget() {
        AppWidgetManager am = AppWidgetManager.getInstance(this);
        if (Build.VERSION.SDK_INT >= 26 && am.isRequestPinAppWidgetSupported()) {
            am.requestPinAppWidget(new ComponentName(this, LeccionWidget.class), null, null);
        } else {
            new AlertDialog.Builder(this)
                    .setTitle("Poner el widget")
                    .setMessage("Deja presionado un espacio vacío de la pantalla de inicio, toca «Widgets» y busca «Un Curso de Milagros».")
                    .setPositiveButton("Entendido", null)
                    .show();
        }
    }

    private void confirmarDesvincular() {
        new AlertDialog.Builder(this)
                .setTitle("¿Desvincular este celular?")
                .setMessage("El widget dejará de mostrar tu lección y se apagará el recordatorio. Puedes volver a vincularlo desde Ajustes.")
                .setNegativeButton("Cancelar", null)
                .setPositiveButton("Desvincular", (d, w) -> enSegundoPlano(() -> {
                    Servidor.desvincular(this);
                    Datos.desvincular(this);
                    Datos.guardarRecordatorio(this, false, Datos.minutoRecordatorio(this));
                    Programador.reprogramarTodo(this);
                    LeccionWidget.pintarTodos(this);
                    runOnUiThread(this::pintar);
                }))
                .show();
    }

    private static void enSegundoPlano(Runnable r) {
        new Thread(r).start();
    }
}
