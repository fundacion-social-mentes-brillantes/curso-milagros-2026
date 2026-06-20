# Un Curso de Milagros 2026 — Gimnasio Emocional Mentes Brillantes

App web privada para acompañar el **proceso diario de las 365 lecciones** de Un Curso de Milagros: video, texto original protegido, guía explicativa, progreso personal, foro por lección y panel de administración.

- 🌐 **En línea:** https://curso-milagros-2026.vercel.app
- 📦 **Repositorio:** https://github.com/fundacion-social-mentes-brillantes/curso-milagros-2026
- ⚙️ **Despliegue:** automático en Vercel con cada cambio en la rama `main`.

> 🚀 ¿Solo quieres ponerla a funcionar? Sigue **[INSTALACION.md](./INSTALACION.md)** paso a paso.

---

## Identidad

- **Estética “Amanecer del alma”**: índigo/violeta profundo + oro suave + aqua sereno + crema cálida. Sin rojo. Modo claro y oscuro.
- Tipografías: **Fraunces** (títulos) + **Nunito** (texto).
- Sensación: espiritual, cálida, moderna, premium, simple.

## Tecnología (y por qué)

| Área | Elección | Motivo |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript estricto** | Moderno, ideal para Vercel |
| Estilos | **Tailwind CSS** | Rápido y consistente, sin librerías de UI pesadas |
| Auth | **Firebase Auth (Google)** | Login con Google en 1 clic, gratis |
| Base de datos | **Cloud Firestore** | Modelo de documentos perfecto para este caso, plan gratis |
| Imágenes | **Firebase Storage** (opcional) | Solo para imágenes; videos NO van aquí |
| Videos | **Embebidos por enlace** (Drive/YouTube) | Cero costo y cero peso en el repo |
| Deploy | **Vercel** | Despliegue directo desde Git |

**Firebase vs Supabase:** se eligió **Firebase** por costo $0, simplicidad y porque ya lo usas. Supabase solo convendría con SQL relacional complejo, que aquí no se necesita.

## El texto original es intocable

Cada lección separa por completo:
- `originalText` → **texto del Curso, exacto, sin modificar** (se importa o se pega; nunca se reescribe).
- `commentary` → contenido **explicativo mejorado** (las 8 secciones), editable.

La interfaz nunca mezcla ni altera `originalText`.

## Estructura

```
src/
├─ app/                  # rutas (App Router)
│  ├─ page.tsx           # portada
│  ├─ login/             # entrar con Google
│  ├─ dashboard/         # "Mi camino" (progreso personal)
│  ├─ lecciones/         # lista + /[numero] página de lección
│  ├─ admin/             # panel, usuarios, lecciones, foro
│  └─ api/session/       # asigna admin de forma segura (servidor)
├─ components/           # UI, lección, foro, admin, layout
├─ lib/                  # firebase, datos, lógica, utilidades
├─ config/              # links de las 365 lecciones, videos, sitio
├─ data/lesson-25.ts     # contenido modelo de la Lección 25
└─ types/                # modelo de datos (TypeScript)
scripts/                 # seed, importador, videos, admin
firestore.rules          # seguridad de la base de datos
storage.rules            # seguridad de archivos
```

## Comandos

```bash
npm install            # instalar
npm run dev            # desarrollo en http://localhost:3000
npm run build          # compilar para producción
npm run seed           # crear las 365 lecciones + Lección 25 de ejemplo
npm run import:textos  # importar el texto original desde el blog (todas)
npm run import:textos -- 1 30   # importar solo lecciones 1 a 30
npm run videos:apply   # aplicar los videos de src/config/videos.config.ts
npm run set:admin      # (opcional) forzar admin desde la terminal
```

## Modelo de datos (Firestore)

- `users/{uid}` — perfil, rol, lección actual, completadas, actividad.
- `lessons/{id}` — `id` con ceros (ej. `025`); `originalText`, `commentary`, `video`, etc.
- `progress/{uid_n}` — lección hecha por persona (con fecha/hora).
- `forumPosts/{id}` — mensajes del foro (con estado de moderación).
- `adminSettings/config` — ajustes generales.

## Seguridad

- Cada quien solo modifica **su** progreso.
- Todos los autenticados leen lecciones y publican en el foro.
- Solo **admin** edita lecciones/roles y modera el foro.
- El admin se reconoce por **correo verificado de Google** directamente en las reglas de Firestore (sin claves secretas) y, opcionalmente, por `role: "admin"` en su documento. La app no usa ningún service account.
- **Configuración inicial** (crear las 365 lecciones e importar textos) se hace desde el panel **/admin/lecciones**, sin terminal.

Detalle completo y pasos manuales en **[INSTALACION.md](./INSTALACION.md)**.

## Imágenes (Codex)

Cuando quieras embellecer con imágenes reales, usa **[PROMPT_CODEX_IMAGENES_Y_EMBELLECIMIENTO.md](./PROMPT_CODEX_IMAGENES_Y_EMBELLECIMIENTO.md)**.
