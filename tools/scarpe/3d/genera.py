# Genera il 3D di una scarpa dalle sue viste scontornate, con TRELLIS (Hugging Face).
# uso: python -I genera.py <cartella viste> <uscita.glb>
# Nella cartella: esterno.png (obbligatoria), e se ci sono interno, tallone, punta, alto, suola.
# Serve il login Hugging Face (`hf auth login`): senza, la quota GPU gratuita finisce subito.
import sys, os, shutil
from gradio_client import Client, handle_file
from huggingface_hub import get_token
from PIL import Image

cartella, uscita = sys.argv[1], sys.argv[2]
seed = int(sys.argv[3]) if len(sys.argv) > 3 else 7

# Il modello vuole immagini quadrate con la scarpa al centro.
quadrate = os.path.join(cartella, "_quadrate"); os.makedirs(quadrate, exist_ok=True)
viste = []
for n in ["esterno", "interno", "tallone", "punta", "alto", "suola"]:
    p = os.path.join(cartella, f"{n}.png")
    if not os.path.exists(p): continue
    im = Image.open(p).convert("RGBA"); im.thumbnail((900, 900))
    q = Image.new("RGBA", (1024, 1024), (255, 255, 255, 0))
    q.paste(im, ((1024 - im.width) // 2, (1024 - im.height) // 2), im)
    q.save(os.path.join(quadrate, f"{n}.png")); viste.append(n)
print("viste:", ", ".join(viste))

c = Client("trellis-community/TRELLIS", verbose=False, token=get_token(), httpx_kwargs={"timeout": 300})
try: c.predict(api_name="/start_session")
except Exception as e: print("start_session:", e)
r = c.predict(image=handle_file(os.path.join(quadrate, "esterno.png")),
    multiimages=[{"image": handle_file(os.path.join(quadrate, f"{n}.png")), "caption": None} for n in viste],
    seed=seed, ss_guidance_strength=7.5, ss_sampling_steps=25,
    slat_guidance_strength=3.0, slat_sampling_steps=25,
    multiimage_algo="stochastic", mesh_simplify=0.9, texture_size=2048,
    api_name="/generate_and_extract_glb")
p = r[1].get("value") if isinstance(r[1], dict) else r[1]
shutil.copy(p, uscita); print("ok", uscita)
