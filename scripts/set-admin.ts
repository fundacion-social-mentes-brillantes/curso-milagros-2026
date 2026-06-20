/**
 * Asigna el rol de administrador (custom claim + rol en Firestore).
 * Normalmente NO necesitas correrlo: el login ya promueve a los correos de
 * ADMIN_EMAILS automáticamente. Úsalo si quieres forzarlo desde la terminal.
 *
 *   npm run set:admin                 (todos los de ADMIN_EMAILS)
 *   npm run set:admin -- correo@x.com (uno específico)
 *
 * La persona debe haber iniciado sesión al menos una vez.
 */
import { auth, db, adminEmails } from "./_admin";

async function main() {
  const arg = process.argv[2];
  const emails = arg ? [arg.toLowerCase()] : adminEmails();

  if (emails.length === 0) {
    console.log("No hay correos. Define ADMIN_EMAILS en .env.local o pasa un correo.");
    process.exit(0);
  }

  for (const email of emails) {
    try {
      const user = await auth().getUserByEmail(email);
      await auth().setCustomUserClaims(user.uid, { admin: true });
      await db().doc(`users/${user.uid}`).set({ role: "admin" }, { merge: true });
      console.log(`★ Admin asignado a ${email}`);
    } catch {
      console.log(`⚠️  ${email}: aún no ha iniciado sesión (debe entrar una vez primero).`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
