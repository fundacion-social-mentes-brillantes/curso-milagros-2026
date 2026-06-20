/**
 * Empuja a Firestore los videos definidos en src/config/videos.config.ts.
 * Edita ese archivo (pega los links de Google Drive / YouTube y pon
 * status "available") y luego corre:
 *
 *   npm run videos:apply
 */
import { db } from "./_admin";
import { VIDEO_MAP } from "../src/config/videos.config";
import { lessonDocId } from "../src/config/lessons.links";

async function main() {
  const firestore = db();
  let applied = 0;
  let available = 0;

  for (const [key, entry] of Object.entries(VIDEO_MAP)) {
    const n = Number(key);
    await firestore.doc(`lessons/${lessonDocId(n)}`).set(
      {
        number: n,
        video: { type: entry.type, url: entry.url, status: entry.status },
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    applied++;
    if (entry.status === "available") available++;
  }

  console.log(`✅ Videos aplicados a ${applied} lecciones (${available} disponibles).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error aplicando videos:", err);
  process.exit(1);
});
