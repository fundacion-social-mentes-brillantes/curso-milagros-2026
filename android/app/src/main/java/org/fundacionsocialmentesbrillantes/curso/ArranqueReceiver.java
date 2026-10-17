package org.fundacionsocialmentesbrillantes.curso;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Android borra las alarmas al reiniciar el celular, al actualizar la app y
 * cuando cambia la hora o la zona horaria. Aquí se vuelven a poner, y el
 * widget se repinta por si cambió el día mientras tanto.
 */
public class ArranqueReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Context c = context.getApplicationContext();
        Programador.reprogramarTodo(c);
        LeccionWidget.pintarTodos(c);
    }
}
