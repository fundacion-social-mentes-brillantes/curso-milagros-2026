# Contrato de la API — Curso de Milagros

Todo lo que antes hacía Firestore desde el navegador ahora pasa por aquí.

**Identidad:** sigue siendo el login con Google de Firebase. El navegador manda
el token en `Authorization: Bearer <idToken>`; el servidor lo verifica contra las
llaves públicas de Google (`api/src/shared/auth.js`). No hay ninguna clave
secreta de Firebase en Azure.

**Regla de oro:** las 21 reglas de `firestore.rules` ya no las aplica nadie
automáticamente. Cada ruta declara su nivel con `manejar(acceso, …)`:

| acceso | quién entra |
|---|---|
| `"publico"` | cualquiera |
| `"sesion"` | quien entró con Google |
| `"admin"` | además, `role === "admin"` o la cuenta de la fundación |

El rol se lee **del perfil guardado**, nunca de lo que diga el navegador.

---

## Rutas

### Personas — `usuarios.js` ✅ hecho
| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/yo` | sesión | Mi perfil; lo crea la primera vez |
| PATCH | `/api/yo` | sesión | Mis datos. **Ignora** `role`, `plan`, `enrolled` |
| POST | `/api/yo/actividad` | sesión | Marca última actividad |
| GET | `/api/usuarios` | admin | Lista completa |
| PATCH | `/api/usuarios/{uid}` | admin | `enrolled`, `voiceReader`, `plan`; `role` solo la cuenta principal |

### Avance y ranking — `avance.js`
| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/avance` | sesión | Todo mi avance del ciclo → `{avance:[…]}` |
| GET | `/api/avance/{n}` | sesión | Una lección → `{lessonNumber,completed,completedAt,nota}` o 404 |
| POST | `/api/avance/{n}` | sesión | Cuerpo `{completed:boolean}` → `{position:number|null}` |
| PUT | `/api/avance/{n}/nota` | sesión | Cuerpo `{nota:string}` (máx 1000) |
| GET | `/api/notas` | sesión | Mis notas ordenadas por lección |
| GET | `/api/ranking/{n}` | sesión | Mi puesto en esa lección → `{position:number|null}` |
| GET | `/api/ranking-dia/{fecha}` | admin | Quiénes marcaron ese día (`YYYY-MM-DD`) |

**Al marcar hecha (`POST /api/avance/{n}` con `completed:true`):**
1. Guarda la fila de avance.
2. Recuenta las completadas y actualiza `completedLessonsCount`.
3. `currentLesson = max(actual, n+1)` acotado a 365. **Solo sube, nunca baja.**
4. `lastActivityAt` y `lastCompletedAt` = ahora.
5. Ranking: si no existía su fila en `dailyDone`, `position = (cuántos ya la hicieron) + 1`,
   y suma `rankDias +1`, `rankSumaPuesto += position`, `rankSumaMinuto += minuto del día en Bogotá`.
6. **La cuenta de la fundación NO entra al ranking** (no es participante).
7. Si el ranking falla, **marcar la lección debe funcionar igual** (va en try/catch).

### Foro — `foro.js`
| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/foro/{n}` | sesión | Mensajes visibles de la lección, más viejo primero |
| POST | `/api/foro/{n}` | sesión | `{message, parentId?}`. Guarda autor del token, **no** del cuerpo |
| PATCH | `/api/foro/{n}/{id}` | sesión | `{status:…}` — ver la regla de abajo |
| GET | `/api/foro-reciente` | admin | Últimos 50 de todas las lecciones |

`status` por defecto `"visible"`. Los `"deleted"` y `"hidden"` no se devuelven a
quien no es admin. Mensaje máx 2000 caracteres.

**Quién puede cambiar el estado de un mensaje (importante, hoy funciona así):**

- El **autor** puede poner el suyo en `"deleted"`, y nada más. Es su mensaje y
  tiene derecho a retirarlo; no se le puede quitar esa posibilidad.
- Un **admin** puede poner cualquier estado en cualquier mensaje.
- Cualquier otra combinación → 403.

### Lecciones — `lecciones.js`
| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/lecciones/{n}` | público | Edición del admin, o 404 si no hay (el navegador usa la estática) |
| PUT | `/api/lecciones/{n}` | admin | Guarda la edición |

El texto original y el comentario viajan como objeto; `tablas.js` los guarda
como JSON solo. **`originalText` no se toca nunca**: si el cuerpo no lo trae, se
conserva el que había.

### Directorio y configuración — `varios.js`
| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | `/api/directorio` | sesión | `{uid: nombre}` de los compañeros |
| GET | `/api/config` | público | `{ciclo:"2026"}` |
| PUT | `/api/config` | admin | `{ciclo}` — arranca un año nuevo |

---

## Cómo se guarda (`tablas.js`)

| Tabla | Partición | Fila |
|---|---|---|
| `users` | `"u"` | uid |
| `progress` | `"{ciclo}\|{uid}"` | `"001"`…`"365"` |
| `dailyDone` | `"{ciclo}\|L042"` | uid |
| `forumPosts` | `"L042"` | id del mensaje |
| `lessons` | `"l"` | `"042"` |
| `directorio` | `"d"` | uid |
| `recordatorios` | `"r"` | `"2026-09-15"` |

Objetos y listas se guardan como texto JSON con `__json_` delante y se
reconstruyen solos al leer. No hace falta hacer nada especial.

Ciclo por defecto: `"2026"` (`CICLO_POR_DEFECTO`).

## Reglas de estilo

- Todo en **español**, incluidos nombres de función y comentarios.
- Comentar **por qué**, no qué. Como el resto del proyecto.
- Nunca confiar en el cuerpo de la petición para identidad o permisos.
- Errores: `json({error:"..."}, codigo)`. Nunca filtrar detalles internos.
