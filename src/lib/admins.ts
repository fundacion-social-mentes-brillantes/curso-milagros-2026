import { ADMIN_EMAILS_PUBLIC } from "@/config/firebase-public";

const ADMIN_EMAILS_LOWER = ADMIN_EMAILS_PUBLIC.map((e) => e.toLowerCase());

/**
 * ¿Es un correo de admin PERMANENTE (la cuenta de gestión de la fundación)?
 * Esa cuenta NO es un participante del curso: se excluye de las estadísticas,
 * del ranking y del historial, y no se le puede quitar el rol de admin.
 */
export function isPermanentAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS_LOWER.includes(email.toLowerCase());
}
