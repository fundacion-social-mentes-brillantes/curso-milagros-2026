# -*- coding: utf-8 -*-
"""
AUDITAR LOS AUDIOS: que digan de verdad lo que dice el guion.

No basta con que el archivo exista y dure lo previsto. Lo que se busca son las
"cosas raras" que ElevenLabs hace de vez en cuando: saltarse una frase,
repetirla, cambiar de tono a mitad, o pronunciar algo de forma extraña.

Se transcribe con Whisper EN LOCAL (no sube nada, no cuesta créditos) y se
compara palabra por palabra contra el texto que se mandó a narrar. Si el audio
dice otra cosa, sale aquí.
"""
import sys, re, unicodedata, glob, os, json
from difflib import SequenceMatcher
sys.path.insert(0, r"C:\Claude\.venv-asr\Lib\site-packages")
from faster_whisper import WhisperModel

def apl(t):
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9ñ ]+", " ", t)).strip()

modelo = WhisperModel("small", device="cpu", compute_type="int8")
print("  (Whisper small, en local)\n")
filas = []
for mp3 in sorted(glob.glob("audio-nuevo/*.mp3")):
    n = os.path.basename(mp3)[:3]
    guion = open(f"audio-nuevo/{n}.txt", encoding="utf-8").read()
    # Las etiquetas <break/> son instrucciones, no palabras: no se dicen, así
    # que contarlas en la comparación hacía bajar el parecido sin motivo.
    guion = re.sub(r"<break[^>]*/?>", " ", guion)
    segs, info = modelo.transcribe(mp3, language="es", beam_size=5, vad_filter=False)
    segs = list(segs)
    dicho = " ".join(s.text for s in segs)
    a, b = apl(guion).split(), apl(dicho).split()
    r = SequenceMatcher(None, a, b, autojunk=False).ratio()
    dur = info.duration
    # Silencios largos entre segmentos: sintoma de corte o de cuelgue.
    huecos = [round(segs[i+1].start - segs[i].end, 1) for i in range(len(segs)-1)
              if segs[i+1].start - segs[i].end > 2.5]
    filas.append((n, r, len(a), len(b), dur, huecos, a, b))

print(f"  {'lec':<5}{'coincide':>10}{'guion':>8}{'dicho':>8}{'dur':>8}   silencios largos")
for n, r, na, nb, dur, hu, *_ in filas:
    señal = "OK " if r >= 0.93 and not hu else "REVISAR"
    print(f"  {n:<5}{r*100:>9.1f}%{na:>8}{nb:>8}{dur:>7.0f}s   {hu if hu else '-':<12} {señal}")

print()
for n, r, na, nb, dur, hu, a, b in filas:
    if r >= 0.93 and not hu:
        continue
    print(f"  ── diferencias en la {n} ──")
    sm = SequenceMatcher(None, a, b, autojunk=False)
    m = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or m >= 4: continue
        m += 1
        print(f"     guion: ...{' '.join(a[max(0,i1-5):i2+5])[:100]}")
        print(f"     dicho: ...{' '.join(b[max(0,j1-5):j2+5])[:100]}")
    print()
