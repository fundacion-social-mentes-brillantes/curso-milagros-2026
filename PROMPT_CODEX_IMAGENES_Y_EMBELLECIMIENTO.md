# Prompt para Codex — Imágenes y embellecimiento visual

Copia y pega TODO lo de abajo a Codex. (Claude no genera imágenes; Codex sí.)

---

## Contexto

Trabajas sobre una app Next.js + TypeScript + Tailwind ya funcional, en
`C:\Programas creados por mi\curso-milagros-2026`. Es el proceso diario de **Un Curso de
Milagros 2026** para **Gimnasio Emocional Mentes Brillantes**. Tu tarea es **crear
e integrar imágenes** y pulir lo visual **sin romper la lógica**.

## Identidad visual (OBLIGATORIO respetarla)

- Estilo: **espiritual, cálido, esperanzador, moderno, premium, sereno**. Tipo “amanecer del alma”.
- **Nada de rojo dominante.** Nada agresivo, viejo, corporativo ni recargado.
- Paleta (hex):
  - Índigo/violeta: `#5B4B9E` · profundo `#2E2A5E`
  - Oro suave amanecer: `#D39A3C` · claro `#F2D8A0`
  - Aqua sereno: `#3CA098`
  - Crema cálida (fondos/lectura): `#FBF7EF`
- Motivos sugeridos: amaneceres, horizontes, luz suave, montañas lejanas, cielo
  degradado, formas orgánicas, destellos sutiles. Abstracto y luminoso, evita
  caras realistas y símbolos religiosos específicos.

## Imágenes a generar (guárdalas en `public/images/`)

| Archivo | Tamaño | Transparencia | Uso |
|---|---|---|---|
| `hero.png` | 1600×1200 | no | Imagen común principal (portada). Amanecer espiritual, degradado índigo→oro→aqua, suave. |
| `og.png` | 1200×630 | no | Vista previa al compartir el enlace. Incluir clima visual, sin texto pequeño. |
| `icon.png` | 512×512 | sí | Ícono/favicon. Símbolo simple (sol naciente / destello ✦) sobre índigo. |
| `empty-video.png` | 800×600 | sí | Estado “Video disponible pronto”. Ilustración tierna de claqueta/pantalla con amanecer. |
| `empty-forum.png` | 800×600 | sí | Estado “Aún no hay mensajes”. Ilustración cálida de comunidad/diálogo. |
| `pattern-soft.png` | 1200×1200 | sí | Textura/fondo muy sutil (opacidad baja) para secciones. |

Optimiza para web (PNG comprimido o WebP, < 300 KB cada una cuando sea posible).

## Integración (sin tocar la lógica)

- **Portada** (`src/app/page.tsx`): reemplaza el círculo decorativo `🌅` del hero por
  `hero.png` usando `next/image` (con `alt` descriptivo). Mantén el texto y los botones.
- **Favicon/OG**: agrega `icon.png` como ícono y `og.png` a `metadata` en
  `src/app/layout.tsx` (campo `openGraph.images`). No cambies el resto del metadata.
- **Estados vacíos**: en `src/components/lesson/VideoPlayer.tsx` (estado “pronto”) y en
  `src/components/forum/Forum.tsx` / `src/components/common/EmptyState.tsx`, puedes mostrar
  `empty-video.png` / `empty-forum.png` junto al texto existente.
- **Fondos**: si usas `pattern-soft.png`, aplícalo con baja opacidad; NO debe afectar la
  legibilidad ni tapar contenido.

## Reglas que NO puedes romper

- ❌ No modifiques nada de **Firebase**, autenticación, reglas, ni la lógica de **progreso/foro**.
- ❌ No toques el **texto original** de las lecciones (`originalText`) ni los campos de datos.
- ❌ No cambies el modelo de datos (`src/types`), ni los scripts, ni las rutas.
- ✅ Mantén el **modo claro y oscuro** funcionando (las imágenes deben verse bien en ambos).
- ✅ Mantén **accesibilidad**: todas las imágenes con `alt`; contraste suficiente.
- ✅ Mantén el diseño **responsive** (celular primero); las imágenes no deben desbordar.
- ✅ Usa las clases/variables de color ya existentes; no introduzcas rojo.

## Entrega

Al terminar, deja un **resumen de archivos modificados** y de las imágenes creadas
(ruta y para qué es cada una). No dejes imágenes sin usar ni referencias rotas.
