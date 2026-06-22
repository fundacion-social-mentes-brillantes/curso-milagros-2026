import type { AppUser, CohortArchive } from "@/types";

/** Quita acentos y deja un nombre de archivo limpio. */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "lista"
  );
}

function fmtDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Genera y DESCARGA un PDF con una lista de personas (inscritas, activas, etc.).
 * Carga jsPDF de forma perezosa para no pesar en el resto de la app.
 */
export async function exportPeoplePdf(
  people: AppUser[],
  opts: { title: string; subtitle?: string; fileBase?: string },
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(22, 110, 96); // esmeralda
  doc.text(opts.title, 40, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(
    "Un Curso de Milagros · Gimnasio Emocional Mentes Brillantes",
    40,
    66,
  );
  doc.text(
    `${opts.subtitle ? opts.subtitle + " · " : ""}${people.length} ${
      people.length === 1 ? "persona" : "personas"
    } · Generado el ${dateStr}`,
    40,
    80,
  );

  const rows = people.map((u, i) => [
    String(i + 1),
    u.fullName || u.displayName || "—",
    u.email || "—",
    u.country || "—",
    u.phone || "—",
    String(u.currentLesson || 1),
    fmtDate(u.lastActivityAt),
  ]);

  autoTable(doc, {
    startY: 96,
    head: [["#", "Nombre", "Correo", "País", "Celular", "Lección", "Últ. actividad"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [22, 110, 96], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 244, 237] },
    columnStyles: {
      0: { cellWidth: 22, halign: "right" },
      5: { halign: "center" },
    },
    margin: { left: 40, right: 40 },
  });

  const base = opts.fileBase ?? slugify(opts.title);
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  doc.save(`${base}-${stamp}.pdf`);
}

/** Descarga el PDF del resumen de un año cerrado (historial). */
export async function exportCohortPdf(cohort: CohortArchive): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const dateStr = cohort.archivedAt
    ? new Date(cohort.archivedAt).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(22, 110, 96);
  doc.text(`Historial — ${cohort.label}`, 40, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text("Un Curso de Milagros · Gimnasio Emocional Mentes Brillantes", 40, 66);
  doc.text(
    `${cohort.total} personas · ${cohort.finishedCount} terminaron · ${cohort.avgCompletion}% promedio${
      dateStr ? ` · Cerrado el ${dateStr}` : ""
    }`,
    40,
    80,
  );

  const rows = cohort.participants.map((p, i) => [
    String(i + 1),
    p.name || "—",
    p.email || "—",
    p.country || "—",
    String(p.completed),
    p.completed >= 365 ? "Terminó" : `Lección ${p.currentLesson}`,
  ]);

  autoTable(doc, {
    startY: 96,
    head: [["#", "Nombre", "Correo", "País", "Completadas", "Estado"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [22, 110, 96], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 244, 237] },
    columnStyles: {
      0: { cellWidth: 22, halign: "right" },
      4: { halign: "center" },
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(`historial-${slugify(cohort.label)}.pdf`);
}
