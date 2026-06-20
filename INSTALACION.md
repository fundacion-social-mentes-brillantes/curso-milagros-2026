# Guía de instalación (paso a paso) 🌅

Buenas noticias: esta app **no necesita ninguna clave secreta** (ni service
account). Funciona solo con las claves públicas de Firebase + las reglas de
seguridad. No necesitas ser programador.

> Tu organización de Google bloquea crear claves de servicio — por eso usamos
> este método más simple y seguro: el admin se reconoce por tu **correo de Google**.

---

## 0) Lo que necesitas
- **Node.js 18+** (https://nodejs.org) — solo para correr la app en tu PC mientras la pruebas.
- Tu **cuenta de Google** de la fundación.
- (Para publicar) una cuenta en **Vercel** (gratis).

---

## 1) En Firebase (ya casi lo tienes) ✅
1. Proyecto creado: **curso-milagros-2026** ✔
2. **Authentication → Google** activado ✔
3. **Firestore Database** creada (modo producción) ✔

---

## 2) Pegar las reglas de seguridad (1 vez)
1. En Firebase → **Firestore Database** → pestaña **Reglas**.
2. Borra lo que haya y **pega el contenido del archivo `firestore.rules`** del proyecto.
3. Clic en **Publicar**.

> Esto hace que solo tú (tu correo) seas admin, y que cada persona solo pueda
> tocar su propio avance. (Si activas Storage para imágenes, pega también `storage.rules`.)

---

## 3) Conexión de la app
✔ Ya quedó lista: tu archivo `.env.local` ya tiene tus claves públicas y tu correo
de admin. (No tienes que hacer nada aquí.)

---

## 4) Probar en tu computador
En una terminal dentro de `C:\Claude\proyectos\curso-milagros-2026`:
```bash
npm run dev
```
Abre **http://localhost:3000** en tu navegador.

> Si ya tenías una ventana abierta de antes, ciérrala y vuelve a correr `npm run dev`
> para que tome las claves nuevas.

---

## 5) Entrar y preparar el contenido (desde la web, sin terminal)
1. Entra con **Google** (tu correo de la fundación). Quedas **admin** automáticamente.
2. Ve al menú **Admin → Lecciones** (o `/admin/lecciones`).
3. Arriba verás **“Preparar el contenido”**:
   - Botón **“Crear lecciones”** → crea las 365 + la Lección 25 de ejemplo.
   - **“Importar texto original”** → escribe un tramo (ej. *Desde* 1 *Hasta* 30) y dale
     **Importar**. Repite por tramos (31–60, 61–90, …). Las **361–365** se pegan a mano.
4. Revisa cualquier lección y ajústala en el mismo editor si hace falta.

---

## 6) Los videos
1. Sube tu carpeta **“Videos Curso de Milagros”** a **Google Drive** (o a YouTube “no listado”).
2. En Drive: cada video → **Compartir** → “Cualquiera con el enlace” → copiar enlace.
3. En **/admin/lecciones**, abre la lección, pega el enlace, elige tipo *Google Drive*
   y estado *Disponible*, y **Guardar**. (Si falta, se ve “Video disponible pronto”.)

---

## 7) Publicar en Vercel
1. Sube el proyecto a un repositorio de GitHub.
2. En https://vercel.com → **Add New → Project** → importa el repo.
3. En **Environment Variables** agrega **solo estas** (las mismas de `.env.local`,
   todas empiezan por `NEXT_PUBLIC_`):
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_ADMIN_EMAILS`
   - `NEXT_PUBLIC_COURSE_YEAR` (opcional)

   *(No hay ninguna clave secreta que agregar. 🎉)*
4. **Deploy**.
5. Copia el dominio que te da Vercel (ej. `tu-app.vercel.app`) y agrégalo en
   Firebase → **Authentication → Settings → Authorized domains**.

¡Listo! 🌅

---

## Soluciones a problemas comunes
- **No veo el menú “Admin”** → entra con el correo que está en `NEXT_PUBLIC_ADMIN_EMAILS`;
  cierra sesión y vuelve a entrar.
- **“Missing or insufficient permissions”** → te faltó **Publicar las reglas** (paso 2).
- **No carga / “Falta configurar Firebase”** → cierra y vuelve a correr `npm run dev`.
- **El login abre y se cierra** → al publicar en Vercel, agrega el dominio en
  *Authorized domains* (paso 7.5). En local, `localhost` ya está permitido.
- **Una lección quedó “para revisar”** → ábrela en `/admin/lecciones` y ajusta el texto.

---

### (Avanzado / opcional) Scripts de terminal
No los necesitas. Si algún día quisieras usarlos (`npm run seed`, `import:textos`,
`rules:deploy`), requieren credenciales de Admin vía Google Cloud
(`gcloud auth application-default login`). El camino normal es todo desde la web.
