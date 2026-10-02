"""Genera le icone Android dal marchio di assets/icon.png.

Uso:  python tools/icone-android.py

⚠️ Non si usa `npx capacitor-assets generate`: scala l'icona intera dentro il
primo piano adattivo, e la maschera circolare di Android taglia «FLEOFIT» ai
lati. Qui si ritaglia la sola scritta e la si mette nella zona sicura (il
cerchio centrale da 66dp su 108dp), con il fondo #0B0B0B come colore a parte.
"""
from pathlib import Path
from PIL import Image

RADICE = Path(__file__).resolve().parent.parent
RES = RADICE / 'android/app/src/main/res'
FONDO = (11, 11, 11)

sorgente = Image.open(RADICE / 'assets/icon.png').convert('RGBA')
# La scritta: tutto ciò che si stacca dal fondo quasi nero.
maschera = sorgente.convert('L').point(lambda v: 255 if v > 40 else 0)
scritta = sorgente.crop(maschera.getbbox())
# Il fondo diventa trasparente, così il primo piano si appoggia sul colore.
dati = [(r, g, b, 0) if max(r, g, b) < 40 else (r, g, b, a) for r, g, b, a in scritta.getdata()]
scritta.putdata(dati)

def primo_piano(lato, larghezza_relativa):
    tela = Image.new('RGBA', (lato, lato), (0, 0, 0, 0))
    w = round(lato * larghezza_relativa)
    h = round(scritta.height * w / scritta.width)
    tela.alpha_composite(scritta.resize((w, h), Image.LANCZOS), ((lato - w) // 2, (lato - h) // 2))
    return tela

DENSITA = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for nome, k in DENSITA.items():
    cartella = RES / f'mipmap-{nome}'
    # Primo piano adattivo: 108dp, scritta larga 58dp → dentro il cerchio da 66dp.
    primo_piano(round(108 * k), 58 / 108).save(cartella / 'ic_launcher_foreground.png')
    # Icone legacy (Android < 8): 48dp, fondo pieno.
    lato = round(48 * k)
    quadrata = Image.new('RGBA', (lato, lato), FONDO + (255,))
    quadrata.alpha_composite(primo_piano(lato, .78))
    quadrata.save(cartella / 'ic_launcher.png')
    tonda = Image.new('RGBA', (lato, lato), (0, 0, 0, 0))
    disco = Image.new('L', (lato, lato), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(disco).ellipse((0, 0, lato - 1, lato - 1), fill=255)
    tonda.paste(quadrata, (0, 0), disco)
    tonda.save(cartella / 'ic_launcher_round.png')

# Lo schermo di lancio di Android < 12 (`@drawable/splash`): fondo pieno e
# scritta al centro. Da Android 12 lo disegna il sistema con l'icona (styles.xml).
for cartella in RES.glob('drawable*'):
    vecchio = cartella / 'splash.png'
    if not vecchio.exists():
        continue
    w, h = Image.open(vecchio).size
    tela = Image.new('RGBA', (w, h), FONDO + (255,))
    lato = min(w, h)
    tela.alpha_composite(primo_piano(lato, .5), ((w - lato) // 2, (h - lato) // 2))
    tela.convert('RGB').save(vecchio)
print('fatto')
