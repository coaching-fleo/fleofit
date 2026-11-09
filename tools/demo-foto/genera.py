#!/usr/bin/env python3
"""I ritratti degli atleti finti dell'ambiente di prova (09/11/2026).

Disegni SVG, non foto: nessuna persona vera, niente da scaricare. Servono a
vedere come rendono le foto profilo (colori, contrasto sul fondo scuro) al
posto delle iniziali. Stanno in tools/, come le foto delle scarpe: le serve
solo il server di sviluppo (`npm run demo`), e non finiscono nell'app.

    python3 tools/demo-foto/genera.py
"""
from pathlib import Path

QUI = Path(__file__).parent

# id, carnagione, capelli (colore, taglio), barba, maglia, sfondo (alto, basso)
PERSONE = [
    ('coach-federico', '#e8b896', ('#2b1d14', 'ciuffo'), True, '#f1ba17', ('#3a4a5c', '#1c2530')),
    ('at-marco', '#d9a27c', ('#1f1611', 'corto'), True, '#2f4858', ('#7a8f6a', '#3d4a33')),
    ('at-luca', '#f0c7a6', ('#7a4a26', 'ciuffo'), False, '#b23a48', ('#5d6d8a', '#2c3446')),
    ('at-giulia', '#f2c9ab', ('#2a1a12', 'lunghi'), False, '#14806f', ('#c98f6b', '#6e4733')),
    ('at-andrea', '#a8734f', ('#141010', 'rasato'), True, '#3b3f8f', ('#c2a35a', '#6b5524')),
    ('at-sara', '#f4d0b5', ('#c58b3d', 'coda'), False, '#6a4c93', ('#5f9ea0', '#2f5354')),
    ('at-paolo', '#e1b08c', ('#8a8a8a', 'corto'), True, '#4f5d2f', ('#9a7aa0', '#4a3550')),
    ('at-chiara', '#eec0a0', ('#8c2f1b', 'caschetto'), False, '#264653', ('#e0a96d', '#7a5330')),
    ('at-elena', '#7c4f36', ('#120c0a', 'ricci'), False, '#e76f51', ('#6c8ebf', '#33476a')),
    ('at-davide', '#c98e66', ('#3a2618', 'ricci_corti'), False, '#1d3557', ('#b56576', '#5c2f3a')),
    ('at-sofia', '#f6d5bd', ('#e3c16f', 'lunghi'), False, '#2a9d8f', ('#8d99ae', '#3f4656')),
]


def scurisci(hexc, f):
    """Lo stesso colore più scuro (f < 1) o più chiaro (f > 1)."""
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    m = lambda v: max(0, min(255, round(v * f if f <= 1 else v + (255 - v) * (f - 1))))
    return f'#{m(r):02x}{m(g):02x}{m(b):02x}'


def capelli_dietro(stile, c):
    if stile == 'lunghi':
        return f'<path d="M66 122 C60 58 98 36 130 38 C166 40 198 64 190 126 L198 226 C168 240 88 240 58 226 Z" fill="{c}"/>'
    if stile == 'caschetto':
        return f'<path d="M66 120 C60 60 98 38 130 40 C164 42 196 64 190 122 L192 182 C176 192 80 192 64 182 Z" fill="{c}"/>'
    if stile == 'coda':
        return (f'<circle cx="128" cy="40" r="24" fill="{c}"/>'
                f'<circle cx="128" cy="40" r="24" fill="url(#lucido)" opacity=".35"/>')
    if stile == 'ricci':
        palle = [(70, 120, 24), (186, 120, 24), (66, 154, 22), (190, 154, 22), (74, 186, 20), (182, 186, 20)]
        return ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>' for x, y, r in palle)
    return ''


def capelli_davanti(stile, c):
    if stile in ('corto', 'rasato'):
        op = ' opacity=".55"' if stile == 'rasato' else ''
        return (f'<path d="M74 114 C70 62 102 44 130 45 C162 46 188 66 182 116 '
                f'C174 92 158 80 128 79 C102 79 86 92 74 114 Z" fill="{c}"{op}/>')
    if stile == 'ciuffo':
        return (f'<path d="M74 114 C68 60 100 38 134 40 C170 42 192 70 182 116 '
                f'C176 96 164 84 140 82 C150 74 152 64 146 58 C132 76 104 78 90 92 C82 98 76 106 74 114 Z" fill="{c}"/>')
    if stile in ('lunghi', 'caschetto', 'coda'):
        return (f'<path d="M72 120 C68 64 104 46 132 47 C166 48 188 72 184 120 '
                f'C176 94 158 80 132 80 C120 92 96 100 72 120 Z" fill="{c}"/>')
    if stile == 'ricci':
        palle = [(84, 84, 22), (106, 64, 24), (132, 56, 25), (158, 64, 24), (178, 86, 22), (76, 108, 18), (184, 108, 18)]
        return ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>' for x, y, r in palle)
    if stile == 'ricci_corti':
        palle = [(88, 86, 16), (106, 70, 18), (128, 64, 19), (150, 70, 18), (170, 86, 16), (80, 104, 12), (178, 104, 12)]
        return ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>' for x, y, r in palle)
    return ''


def ritratto(pelle, capelli, barba, maglia, sfondo):
    colore, stile = capelli
    ombra = scurisci(pelle, .82)
    profonda = scurisci(pelle, .68)
    maglia_s = scurisci(maglia, .7)
    barba_svg = (f'<path d="M80 128 C82 168 104 186 128 186 C152 186 174 168 176 128 '
                 f'C170 150 158 160 146 158 C138 150 118 150 110 158 C98 160 86 150 80 128 Z" fill="{colore}" opacity=".88"/>'
                 if barba else '')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{sfondo[0]}"/><stop offset="1" stop-color="{sfondo[1]}"/>
    </linearGradient>
    <radialGradient id="viso" cx=".42" cy=".38" r=".75">
      <stop offset="0" stop-color="{scurisci(pelle, 1.08)}"/><stop offset=".7" stop-color="{pelle}"/><stop offset="1" stop-color="{ombra}"/>
    </radialGradient>
    <linearGradient id="maglia" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{maglia}"/><stop offset="1" stop-color="{maglia_s}"/>
    </linearGradient>
    <linearGradient id="lucido" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="luce" cx=".3" cy=".2" r=".9">
      <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="256" height="256" fill="url(#fondo)"/>
  <rect width="256" height="256" fill="url(#luce)"/>
  {capelli_dietro(stile, colore)}
  <path d="M30 256 C34 214 70 196 128 196 C186 196 222 214 226 256 Z" fill="url(#maglia)"/>
  <path d="M104 198 L128 226 L152 198 Z" fill="{maglia_s}" opacity=".7"/>
  <rect x="108" y="164" width="40" height="40" rx="14" fill="{profonda}"/>
  <path d="M106 196 C114 208 142 208 150 196 L150 200 C140 212 116 212 106 200 Z" fill="{maglia_s}"/>
  <ellipse cx="76" cy="128" rx="10" ry="15" fill="{ombra}"/>
  <ellipse cx="180" cy="128" rx="10" ry="15" fill="{ombra}"/>
  <ellipse cx="128" cy="120" rx="52" ry="62" fill="url(#viso)"/>
  {barba_svg}
  {capelli_davanti(stile, colore)}
  <path d="M98 108 Q108 101 118 106" stroke="{scurisci(colore, .9)}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <path d="M138 106 Q148 101 158 108" stroke="{scurisci(colore, .9)}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <ellipse cx="108" cy="122" rx="5.5" ry="6.5" fill="#1b1410"/>
  <ellipse cx="148" cy="122" rx="5.5" ry="6.5" fill="#1b1410"/>
  <circle cx="110" cy="120" r="1.8" fill="#fff" opacity=".85"/>
  <circle cx="150" cy="120" r="1.8" fill="#fff" opacity=".85"/>
  <path d="M128 126 Q122 142 129 145" stroke="{profonda}" stroke-width="3" stroke-linecap="round" fill="none"/>
  <ellipse cx="98" cy="140" rx="9" ry="5" fill="#e0726b" opacity=".18"/>
  <ellipse cx="158" cy="140" rx="9" ry="5" fill="#e0726b" opacity=".18"/>
  <path d="M114 156 Q128 166 142 156" stroke="{scurisci(pelle, .5)}" stroke-width="4" stroke-linecap="round" fill="none"/>
</svg>
'''


if __name__ == '__main__':
    for id_, pelle, capelli, barba, maglia, sfondo in PERSONE:
        (QUI / f'{id_}.svg').write_text(ritratto(pelle, capelli, barba, maglia, sfondo))
    print(f'{len(PERSONE)} ritratti in {QUI}')
