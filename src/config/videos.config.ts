import type { VideoStatus, VideoType } from "@/types";

/**
 * Mapeo de videos por lección.
 *
 * Tus 27 videos están como archivos locales en "Videos Curso de Milagros".
 * Una app publicada NO puede reproducir archivos de tu computador, así que:
 *
 *   1) Sube esa carpeta a Google Drive (o súbelos a YouTube como "no listado").
 *   2) En Drive: clic derecho en cada video > Compartir > "Cualquiera con el enlace".
 *   3) Copia el enlace y pégalo abajo en `url`, cambia `type` a "drive" y
 *      `status` a "available". (O hazlo más cómodo desde el panel /admin/lecciones.)
 *
 * El reproductor extrae solo el ID del enlace, así que puedes pegar el link
 * completo de Drive (.../file/d/EL_ID/view...) sin preocuparte.
 */

export interface VideoEntry {
  type: VideoType;
  /** Link de Google Drive o de YouTube (o URL directa .mp4). */
  url: string;
  status: VideoStatus;
  /** Nombre del archivo local original, solo como referencia. */
  localFile?: string;
}

const EMPTY: VideoEntry = { type: "none", url: "", status: "soon" };

/**
 * Lecciones 1–27: tienes el video listo (falta publicarlo y pegar el link).
 * Las demás quedan en "Video disponible pronto" hasta que agregues su link.
 */
export const VIDEO_MAP: Readonly<Record<number, VideoEntry>> = {
  1: { type: "none", url: "", status: "soon", localFile: "Lección 1.mp4" },
  2: { type: "none", url: "", status: "soon", localFile: "Lección 2.mp4" },
  3: { type: "none", url: "", status: "soon", localFile: "Lección_3.mp4" },
  4: { type: "none", url: "", status: "soon", localFile: "Lección_4.mp4" },
  5: { type: "none", url: "", status: "soon", localFile: "Leccion_5.mp4" },
  6: { type: "none", url: "", status: "soon", localFile: "Lección_6_de_UCDM.mp4" },
  7: { type: "none", url: "", status: "soon", localFile: "Lección_7__Sólo_veo_el_pasado.mp4" },
  8: { type: "none", url: "", status: "soon", localFile: "Lección_8.mp4" },
  9: { type: "none", url: "", status: "soon", localFile: "Leccion_9.mp4" },
  10: { type: "none", url: "", status: "soon", localFile: "Lección_10.mp4" },
  11: { type: "none", url: "", status: "soon", localFile: "Lección_11.mp4" },
  12: { type: "none", url: "", status: "soon", localFile: "Lección_12.mp4" },
  13: { type: "none", url: "", status: "soon", localFile: "Lección_13_UCDM.mp4" },
  14: { type: "none", url: "", status: "soon", localFile: "Lección_14__UCDM.mp4" },
  15: { type: "none", url: "", status: "soon", localFile: "Lección_15.mp4" },
  16: { type: "none", url: "", status: "soon", localFile: "Lección_16__UCDM.mp4" },
  17: { type: "none", url: "", status: "soon", localFile: "Lección_17.mp4" },
  18: { type: "none", url: "", status: "soon", localFile: "Lección_18.mp4" },
  19: { type: "none", url: "", status: "soon", localFile: "Lección_19.mp4" },
  20: { type: "none", url: "", status: "soon", localFile: "Lección_20__Decidido_a_ver.mp4" },
  21: { type: "none", url: "", status: "soon", localFile: "Lección_21_de_UCDM.mp4" },
  22: { type: "none", url: "", status: "soon", localFile: "Lección_22_UCDM.mp4" },
  23: { type: "none", url: "", status: "soon", localFile: "Lección_23__Escapar_del_mundo.mp4" },
  24: { type: "none", url: "", status: "soon", localFile: "Lección_24_UCDM.mp4" },
  25: { type: "none", url: "", status: "soon", localFile: "Lección_25_UCDM.mp4" },
  26: { type: "none", url: "", status: "soon", localFile: "Lección_26_de_UCDM.mp4" },
  27: { type: "none", url: "", status: "soon", localFile: "UCDM__Lección_27.mp4" },
};

export function videoFor(n: number): VideoEntry {
  return VIDEO_MAP[n] ?? EMPTY;
}
