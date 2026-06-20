/**
 * Publica las reglas de seguridad de Firestore (y Storage si está disponible)
 * usando la cuenta de servicio. Así no tienes que pegarlas a mano en la consola.
 *
 *   npm run rules:deploy
 */
import { readFileSync } from "node:fs";
import { admin } from "./_admin";
import { getSecurityRules } from "firebase-admin/security-rules";

async function main() {
  const sr = getSecurityRules(admin());

  const firestoreSource = readFileSync("firestore.rules", "utf8");
  await sr.releaseFirestoreRulesetFromSource(firestoreSource);
  console.log("✅ Reglas de Firestore publicadas.");

  // Storage es opcional (solo si lo activas). Se intenta sin romper si no aplica.
  try {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const anySr = sr as unknown as {
      releaseStorageRulesetFromSource?: (src: string, bucket?: string) => Promise<unknown>;
    };
    if (bucket && typeof anySr.releaseStorageRulesetFromSource === "function") {
      const storageSource = readFileSync("storage.rules", "utf8");
      await anySr.releaseStorageRulesetFromSource(storageSource, bucket);
      console.log("✅ Reglas de Storage publicadas.");
    } else {
      console.log("ℹ️ Storage: si lo activas, pega storage.rules a mano en la consola.");
    }
  } catch {
    console.log("ℹ️ Storage no disponible todavía; se omite (no es un error).");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error publicando reglas:", err);
  process.exit(1);
});
