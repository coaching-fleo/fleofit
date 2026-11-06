# Ritocca il 3D uscito da genera.py.
# uso: python -I ritocca.py ingresso.glb uscita.glb [--suola suola.png] [--senza-giallo] [--gira-suola]
#  - sempre: materiale opaco. TRELLIS non scrive metallicFactor, che in glTF vale 1:
#    il visore lo tratta come metallo e i colori escono scuri e sbagliati.
#  - --suola: stampa la foto vera della suola sui triangoli rivolti in basso (l'IA la inventa).
#    La punta della foto va a destra, come nella vista esterna; --gira-suola se esce al contrario.
#  - --senza-giallo: ridipinge di blu notte le macchie gialle che l'IA mette dentro il collarino.
#    Solo per le scarpe che di giallo non ne hanno.
#  - la texture esce in JPEG: il file passa da ~5 a ~2 MB.
import sys, io, os, argparse, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb import leggi, scrivi

a = argparse.ArgumentParser()
a.add_argument("ingresso"); a.add_argument("uscita")
a.add_argument("--suola"); a.add_argument("--senza-giallo", action="store_true")
a.add_argument("--gira-suola", action="store_true")
arg = a.parse_args()

js, b = leggi(arg.ingresso)
def acc(i):
    x = js["accessors"][i]; bv = js["bufferViews"][x["bufferView"]]
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[x["componentType"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[x["type"]]
    o = bv.get("byteOffset", 0) + x.get("byteOffset", 0)
    r = np.frombuffer(bytes(b), dt, x["count"] * n, o)
    return r.reshape(-1, n) if n > 1 else r

for m in js["materials"]:
    m["pbrMetallicRoughness"]["metallicFactor"] = 0.0
    m["pbrMetallicRoughness"]["roughnessFactor"] = 0.85

pr = js["meshes"][0]["primitives"][0]
P = acc(pr["attributes"]["POSITION"]).astype(np.float64)
UV = acc(pr["attributes"]["TEXCOORD_0"]).astype(np.float64)
I = acc(pr["indices"]).reshape(-1, 3)
im = js["images"][0]; bvi = js["bufferViews"][im["bufferView"]]; o = bvi.get("byteOffset", 0)
tex = np.array(Image.open(io.BytesIO(bytes(b[o:o + bvi["byteLength"]]))).convert("RGB")).astype(np.float64)
H, W = tex.shape[:2]

if arg.senza_giallo:
    hsv = np.array(Image.fromarray(tex.astype(np.uint8)).convert("HSV")).astype(np.float64)
    giallo = (hsv[..., 0] > 22) & (hsv[..., 0] < 50) & (hsv[..., 1] > 90) & (hsv[..., 2] > 60)
    tex[giallo] = [28, 34, 68]
    print("pixel gialli ridipinti:", int(giallo.sum()))

if arg.suola:
    sa = np.array(Image.open(arg.suola).convert("RGBA")).astype(np.float64)
    ys, xs = np.nonzero(sa[..., 3] > 128); sx0, sx1, sy0, sy1 = xs.min(), xs.max(), ys.min(), ys.max()
    nrm = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    giu = nrm[:, 1] < -0.55
    vb = np.unique(I[giu].ravel())
    x0, x1 = P[vb, 0].min(), P[vb, 0].max(); z0, z1 = P[vb, 2].min(), P[vb, 2].max()
    print("triangoli della suola:", int(giu.sum()))
    for t in I[giu]:
        uv = UV[t] * [W, H]
        mn = np.floor(uv.min(0)).astype(int); mx = np.ceil(uv.max(0)).astype(int)
        gx, gy = np.meshgrid(np.arange(mn[0], mx[0] + 1), np.arange(mn[1], mx[1] + 1))
        q = np.stack([gx.ravel() + 0.5, gy.ravel() + 0.5], 1)
        p0, p1, p2 = uv
        v0, v1 = p1 - p0, p2 - p0; d = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(d) < 1e-9: continue
        w1 = ((q[:, 0] - p0[0]) * v1[1] - v1[0] * (q[:, 1] - p0[1])) / d
        w2 = (v0[0] * (q[:, 1] - p0[1]) - (q[:, 0] - p0[0]) * v0[1]) / d
        w0 = 1 - w1 - w2
        k = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not k.any(): continue
        pos = w0[k, None] * P[t[0]] + w1[k, None] * P[t[1]] + w2[k, None] * P[t[2]]
        fx = (pos[:, 0] - x0) / (x1 - x0); fz = (pos[:, 2] - z0) / (z1 - z0)
        if arg.gira_suola: fx = 1 - fx
        ix = np.clip((sx0 + fx * (sx1 - sx0)).astype(int), 0, sa.shape[1] - 1)
        iy = np.clip((sy0 + fz * (sy1 - sy0)).astype(int), 0, sa.shape[0] - 1)
        col = sa[iy, ix]
        tx = np.clip(gx.ravel()[k], 0, W - 1); ty = np.clip(gy.ravel()[k], 0, H - 1)
        al = col[:, 3:4] / 255
        tex[ty, tx] = col[:, :3] * al + tex[ty, tx] * (1 - al)

buf = io.BytesIO(); Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)).save(buf, "JPEG", quality=88)
nuovo = buf.getvalue(); im["mimeType"] = "image/jpeg"
parti = []
for i, bv in enumerate(js["bufferViews"]):
    oo = bv.get("byteOffset", 0)
    parti.append(nuovo if i == im["bufferView"] else bytes(b[oo:oo + bv["byteLength"]]))
out = bytearray()
for bv, p in zip(js["bufferViews"], parti):
    out += b"\0" * (-len(out) % 4); bv["byteOffset"] = len(out); bv["byteLength"] = len(p); out += p
js["buffers"][0]["byteLength"] = len(out)
scrivi(arg.uscita, js, out); print("ok", arg.uscita, f"{len(out) / 1e6:.1f} MB")
