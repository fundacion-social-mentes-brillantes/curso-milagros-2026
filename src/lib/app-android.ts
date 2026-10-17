/**
 * ¿La web está abierta DENTRO de la app de Android del curso?
 *
 * La app es la misma web a pantalla completa en Chrome (Trusted Web Activity),
 * así que no hay forma directa de preguntarlo. Dos pistas, en la primera página
 * que abre la app: la dirección trae `?origen=app-android` (la ponen el ícono,
 * el widget y el recordatorio) y Chrome deja como referente `android-app://`
 * con el nombre del paquete. Se recuerda en sessionStorage —no en localStorage—
 * porque Chrome comparte el almacenamiento del sitio entre la app y sus
 * pestañas normales: así una pestaña del navegador no se cree la app.
 */

export const PAQUETE_ANDROID = "org.fundacionsocialmentesbrillantes.curso";
const CLAVE = "ucdm.app-android";

/**
 * Va en crudo en la cabecera de la página (layout.tsx), antes que React: la
 * portada redirige enseguida a «Hoy» o a la entrada y se llevaría la pista.
 */
export const GUION_APP_ANDROID = `
(function(){try{
var p=new URLSearchParams(location.search).get('origen')==='app-android';
var r=document.referrer.indexOf('android-app://${PAQUETE_ANDROID}')===0;
if(p||r)sessionStorage.setItem('${CLAVE}','1');
}catch(e){}})();
`;

export function enAppAndroid(): boolean {
  try {
    return sessionStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

/**
 * Enlace que abre la pantalla nativa de ajustes de la app (recordatorio y
 * widget) con un código de un solo uso para vincularla a esta cuenta.
 * Chrome solo lo sigue si lo dispara un toque de la persona.
 */
export function enlaceAjustesNativos(codigo: string): string {
  return `intent://ajustes?codigo=${encodeURIComponent(codigo)}#Intent;scheme=ucdmcurso;package=${PAQUETE_ANDROID};end`;
}
