/**
 * Lecciones que ya tienen la NARRACIÓN NUEVA con la voz de Alexandra (oct-2026):
 * lectura serena frase por frase, cada frase escuchada con Whisper para confirmar
 * que dice exactamente su texto, y la música de fondo («Solitary Majesty») YA
 * MEZCLADA dentro del MP3, al nivel que escogió Valeria.
 *
 * Viven en el almacenamiento como `audio/v2/NNN.mp3`. Las lecciones que no están
 * aquí siguen con su audio anterior (`audio/NNN.mp3`) hasta que se terminen.
 * Va en otra carpeta porque los audios viejos se guardan un año en la caché de los
 * teléfonos: con el mismo nombre, mucha gente seguiría oyendo la voz anterior.
 *
 * Lo escribe ~/.ucdm-narracion/preparar_subida.py: no editar a mano.
 */
const RANGOS = "1-14,19,24,41,45-59,61-65,67-74,76,79-81,83,85-92,94-110,112-122,130-137,140-162,166-167,169-170,172-184,186,188,190-192,195-276,278-290,292-331,333-343,345-353,355-365";

export const LECCIONES_VOZ_ALEXANDRA: ReadonlySet<number> = new Set(
  RANGOS.split(",")
    .filter(Boolean)
    .flatMap((r) => {
      const partes = r.split("-").map(Number);
      const desde = partes[0] ?? 0;
      const hasta = partes[1] ?? desde;
      return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
    }),
);
