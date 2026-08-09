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

/**
 * "Mi libro del año": el PDF con todo lo que la persona escribió en su
 * cuaderno, lección por lección. Es lo único del proceso escrito por ella
 * misma, y al terminar el año es la prueba de su propio camino.
 */
export async function exportarMiLibro(
  nombre: string,
  notas: { lessonNumber: number; nota: string }[],
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 56;

  // Portada
  doc.setFillColor(11, 59, 54);
  doc.rect(0, 0, ancho, alto, "F");
  doc.setTextColor(242, 200, 121);
  doc.setFont("times", "bold");
  doc.setFontSize(34);
  doc.text("Mi libro del año", ancho / 2, alto / 2 - 40, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(15);
  doc.setTextColor(245, 239, 226);
  doc.text(nombre, ancho / 2, alto / 2 + 4, { align: "center" });
  doc.setFontSize(11);
  doc.text(
    `${notas.length} ${notas.length === 1 ? "día escrito" : "días escritos"} · Un Curso de Milagros`,
    ancho / 2,
    alto / 2 + 30,
    { align: "center" },
  );
  doc.setFontSize(10);
  doc.text("Gimnasio Emocional Mentes Brillantes", ancho / 2, alto - 60, { align: "center" });

  // Páginas con las notas
  doc.addPage();
  doc.setTextColor(20, 20, 20);
  let y = margen;

  for (const n of notas) {
    const lineas = doc.splitTextToSize(n.nota, ancho - margen * 2 - 12);
    const altoBloque = 26 + lineas.length * 15 + 14;
    if (y + altoBloque > alto - margen) {
      doc.addPage();
      y = margen;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(180, 140, 50);
    doc.text(`Lección ${n.lessonNumber}`, margen, y);
    y += 16;
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(lineas, margen + 10, y);
    y += lineas.length * 15 + 16;
  }

  doc.save(`Mi libro del año — ${nombre}.pdf`);
}
