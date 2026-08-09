"use client";

import { addDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { isPermanentAdmin } from "@/lib/admins";
import { cicloActual, fijarCiclo } from "@/lib/ciclo";
import type { CohortArchive } from "@/types";

export interface ResetResult {
  usersReset: number;
  progressDeleted: number;
  archivedLabel: string;
}

/** Cuántas personas caben por documento de historial (Firestore topa en 1 MB). */
const POR_DOCUMENTO = 600;

/**
 * Comienza un AÑO NUEVO del curso.
 *
 * Cómo funciona (y por qué así):
 * 1. Guarda el RESUMEN del año que termina en la colección "cohorts", partido
 *    en varios documentos si el grupo es grande (un documento de Firestore no
 *    puede pasar de 1 MB; con ~1.500 personas en uno solo, reventaba).
 * 2. Deja el avance de TODAS las personas en cero. Todas reinician juntas:
 *    si unas reiniciaran y otras no, quedarían en calendarios distintos y
 *    solas en el foro, que va por lección.
 * 3. NO BORRA el avance ni el ranking del año viejo: solo cambia el "ciclo"
 *    activo. Borrarlo costaría decenas de miles de escrituras (Firebase
 *    regala 20.000 al día) y, si se cortara a la mitad, dejaría datos rotos.
 *    Con el ciclo, empezar el año cuesta UNA escritura y la historia se
 *    conserva completa.
 *
 * NO toca: cuentas, planes, lecciones/contenido ni el foro.
 * Solo el admin puede ejecutarlo (las reglas de Firestore lo exigen).
 */
export async function resetCourseForNewYear(label: string): Promise<ResetResult> {
  const db = getDb();
  const cleanLabel = label.trim() || String(new Date().getFullYear());
  const cicloViejo = await cicloActual();
  const archivedAt = Date.now();

  // 0) Leer las personas (sirve para el historial y para el reinicio).
  const docs = (await getDocs(collection(db, "users"))).docs;

  // 1) Resumen del año (solo inscritas, sin la cuenta de la fundación).
  const participants = docs
    .map((d) => d.data())
    .filter((u) => u.enrolled !== false && !isPermanentAdmin(String(u.email ?? "")))
    .map((u) => ({
      name: String(u.fullName || u.displayName || "Caminante"),
      email: String(u.email || ""),
      country: String(u.country || ""),
      completed: Number(u.completedLessonsCount || 0),
      currentLesson: Number(u.currentLesson || 1),
    }));

  const total = participants.length;
  const finishedCount = participants.filter((p) => p.completed >= 365).length;
  const avgCompletion = total
    ? Math.round(participants.reduce((a, p) => a + (p.completed / 365) * 100, 0) / total)
    : 0;
  const avgLesson = total
    ? Math.round(participants.reduce((a, p) => a + p.currentLesson, 0) / total)
    : 0;

  // Se parte en varios documentos para no chocar con el límite de 1 MB.
  const partes: (typeof participants)[] = [];
  for (let i = 0; i < participants.length; i += POR_DOCUMENTO) {
    partes.push(participants.slice(i, i + POR_DOCUMENTO));
  }
  if (partes.length === 0) partes.push([]);

  for (let i = 0; i < partes.length; i++) {
    await addDoc(collection(db, "cohorts"), {
      label: cleanLabel,
      ciclo: cicloViejo,
      archivedAt,
      total,
      finishedCount,
      avgCompletion,
      avgLesson,
      parte: i + 1,
      totalPartes: partes.length,
      participants: partes[i],
    });
  }

  // 2) Cambiar el ciclo activo: el avance y el ranking viejos quedan como
  //    historia y el año nuevo arranca limpio, sin borrar un solo documento.
  await fijarCiclo(cleanLabel);

  // 3) Dejar en cero los contadores de cada persona (incluye el acumulado del
  //    ranking, para que "los madrugadores" no arrastre el año pasado).
  let usersReset = 0;
  let batch = writeBatch(db);
  let ops = 0;
  for (const d of docs) {
    batch.update(d.ref, {
      currentLesson: 1,
      completedLessonsCount: 0,
      lastCompletedAt: 0,
      rankDias: 0,
      rankSumaPuesto: 0,
      rankSumaMinuto: 0,
    });
    ops++;
    usersReset++;
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  // progressDeleted queda en 0 a propósito: ya no se borra nada.
  return { usersReset, progressDeleted: 0, archivedLabel: cleanLabel };
}

/**
 * (Admin) Lista los años cerrados (historial), del más reciente al más antiguo.
 * Si un año quedó partido en varios documentos, se vuelven a unir aquí.
 */
export async function listCohorts(): Promise<CohortArchive[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, "cohorts"));
  const porAnio = new Map<string, CohortArchive>();

  for (const d of snap.docs) {
    const data = d.data();
    const archivedAt = Number(data.archivedAt ?? 0);
    const label = String(data.label ?? "");
    const clave = `${label}__${archivedAt}`;
    const gente = Array.isArray(data.participants)
      ? (data.participants as CohortArchive["participants"])
      : [];

    const ya = porAnio.get(clave);
    if (ya) {
      ya.participants = [...ya.participants, ...gente];
      continue;
    }
    porAnio.set(clave, {
      id: d.id,
      label,
      archivedAt,
      total: Number(data.total ?? 0),
      finishedCount: Number(data.finishedCount ?? 0),
      avgCompletion: Number(data.avgCompletion ?? 0),
      avgLesson: Number(data.avgLesson ?? 0),
      participants: gente,
    });
  }

  return [...porAnio.values()].sort((a, b) => b.archivedAt - a.archivedAt);
}
