/**
 * Datos semilla: crea la estructura de las 365 lecciones (si no existen) y
 * llena la Lección 25 como ejemplo modelo. NO sobrescribe lecciones existentes,
 * así nunca borra lo que ya hayas editado.
 *
 *   npm run seed
 */
import { db, adminEmails } from "./_admin";
import { TOTAL_LESSONS, lessonDocId } from "../src/config/lessons.links";
import { buildStubLesson } from "../src/lib/lesson-template";
import { LESSON_25_TITLE, LESSON_25_COMMENTARY } from "../src/data/lesson-25";
import { SITE } from "../src/config/site";

async function main() {
  const firestore = db();
  const now = Date.now();

  const snap = await firestore.collection("lessons").get();
  const existing = new Set(snap.docs.map((d) => d.id));

  let created = 0;
  let batch = firestore.batch();
  let ops = 0;

  for (let n = 1; n <= TOTAL_LESSONS; n++) {
    const id = lessonDocId(n);
    if (existing.has(id)) continue;

    const lesson = buildStubLesson(n, now);
    if (n === 25) {
      lesson.title = LESSON_25_TITLE;
      lesson.commentary = LESSON_25_COMMENTARY;
      lesson.commentaryReady = true;
    }

    batch.set(firestore.doc(`lessons/${id}`), lesson);
    ops++;
    created++;

    if (ops >= 400) {
      await batch.commit();
      batch = firestore.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  await firestore.doc("adminSettings/config").set(
    {
      adminEmails: adminEmails(),
      activeCourseYear: SITE.courseYear,
      currentGlobalLesson: 1,
      updatedAt: now,
    },
    { merge: true },
  );

  console.log(`✅ Semilla lista.`);
  console.log(`   Lecciones creadas: ${created}`);
  console.log(`   Ya existían (intactas): ${existing.size}`);
  console.log(`   Lección 25 incluye la guía completa de ejemplo.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error en la semilla:", err);
  process.exit(1);
});
