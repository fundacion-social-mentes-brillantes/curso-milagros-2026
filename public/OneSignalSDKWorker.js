/*
 * TRABAJADOR DE FONDO DE LA APP (service worker). Hace dos cosas:
 *
 * 1. Las NOTIFICACIONES (OneSignal). La primera línea trae su código; el
 *    nombre de este archivo es el que OneSignal busca, así que no cambiarlo.
 *
 * 2. Que la app ABRA aunque la conexión falle o tarde justo al abrirla.
 *    Valeria (22-nov-2026, iPhone): «Safari no pudo abrir la página porque el
 *    servidor no responde», y había que cerrar y volver a abrir. El servidor
 *    contesta en menos de un segundo (medido); lo que falla es la conexión del
 *    celular en ese instante (recién despierta, cambia de wifi a datos…) y
 *    Safari no reintenta solo. Ahora:
 *      - Cada página que se abre bien queda guardada en el celular.
 *      - Al abrir, se pide a internet como siempre (así se ve lo más nuevo). Si
 *        no contesta en 6 segundos o la conexión falla, se muestra la copia
 *        guardada; y si no hay copia, la pantalla «Conectando con el curso…»,
 *        que reintenta sola y abre la lección apenas haya señal.
 *      - Las piezas de la app (/_next/static) nunca cambian de contenido (cada
 *        versión trae nombres nuevos), así que se guardan y se sirven del
 *        celular: la copia guardada funciona aunque no haya señal.
 *    La API (/api) NUNCA se guarda: el avance y las marcas van siempre al
 *    servidor. La primera vez que alguien abre la app en un celular nuevo no
 *    hay copia todavía: ahí no hay nada que hacer desde aquí.
 */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const PAGINAS = "ucdm-paginas-v1";
const PIEZAS = "ucdm-piezas-v1";
const SIN_CONEXION = "/sin-conexion.html";
const ESPERA_RED = 6000; // pasado esto, la copia guardada
const ESPERA_SIN_COPIA = 20000; // sin copia guardada, se espera un poco más a la red
const MAXIMO_PIEZAS = 400; // que lo guardado no crezca sin fin con cada versión

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(PAGINAS)
      .then((c) => c.add(new Request(SIN_CONEXION, { cache: "reload" })))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((n) => n.startsWith("ucdm-") && n !== PAGINAS && n !== PIEZAS)
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // Google, OneSignal, YouTube…: como siempre
  if (url.pathname.startsWith("/api/")) return; // los datos, siempre del servidor
  if (pedido.mode === "navigate") {
    evento.respondWith(abrirPagina(evento));
  } else if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(pieza(pedido));
  }
});

/** La misma página con o sin «?origen=…» y con o sin «/» final se guarda una sola vez. */
function llaveDePagina(pedido) {
  const u = new URL(pedido.url);
  u.search = "";
  u.hash = "";
  if (!u.pathname.endsWith("/") && !u.pathname.split("/").pop().includes(".")) u.pathname += "/";
  return u.href;
}

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));
const plazo = (promesa, ms) =>
  Promise.race([promesa, esperar(ms).then(() => Promise.reject(new Error("sin respuesta a tiempo")))]);

async function abrirPagina(evento) {
  const pedido = evento.request;
  const llave = llaveDePagina(pedido);
  // Se pide a internet. Si llega bien, se guarda la copia (aunque ya se haya
  // mostrado la guardada por tardar), para tenerla fresca la próxima vez.
  const red = fetch(pedido).then((respuesta) => {
    const html = (respuesta.headers.get("content-type") || "").includes("text/html");
    if (respuesta.ok && html) {
      const copia = respuesta.clone();
      caches.open(PAGINAS).then((c) => c.put(llave, copia)).catch(() => {});
    }
    return respuesta;
  });
  evento.waitUntil(red.catch(() => {}));

  try {
    return await plazo(red, ESPERA_RED);
  } catch {
    const guardada = await caches.match(llave, { cacheName: PAGINAS });
    if (guardada) return guardada;
    try {
      return await plazo(red, ESPERA_SIN_COPIA - ESPERA_RED);
    } catch {
      return (await caches.match(SIN_CONEXION, { cacheName: PAGINAS })) || Response.error();
    }
  }
}

async function pieza(pedido) {
  const cajon = await caches.open(PIEZAS);
  const guardada = await cajon.match(pedido);
  if (guardada) return guardada;
  const respuesta = await fetch(pedido);
  if (respuesta.ok) {
    const copia = respuesta.clone();
    cajon
      .put(pedido, copia)
      .then(() => cajon.keys())
      .then((llaves) => Promise.all(llaves.slice(0, Math.max(0, llaves.length - MAXIMO_PIEZAS)).map((k) => cajon.delete(k))))
      .catch(() => {});
  }
  return respuesta;
}
