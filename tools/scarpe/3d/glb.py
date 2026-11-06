import json, struct, sys
def leggi(path):
    b = open(path, "rb").read()
    n = struct.unpack_from("<I", b, 12)[0]
    js = json.loads(b[20:20+n]); off = 20 + n
    ln = struct.unpack_from("<I", b, off)[0]
    return js, bytearray(b[off+8:off+8+ln])
def scrivi(path, js, binb):
    j = json.dumps(js, separators=(",", ":")).encode(); j += b" " * (-len(j) % 4)
    binb = bytes(binb) + b"\0" * (-len(binb) % 4)
    tot = 12 + 8 + len(j) + 8 + len(binb)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, tot))
        f.write(struct.pack("<II", len(j), 0x4E4F534A)); f.write(j)
        f.write(struct.pack("<II", len(binb), 0x004E4942)); f.write(binb)
if __name__ == "__main__":
    js, binb = leggi(sys.argv[1])
    print(json.dumps(js.get("materials")), json.dumps(js.get("images")), js["meshes"][0]["primitives"][0]["attributes"])
    for i, im in enumerate(js["images"]):
        bv = js["bufferViews"][im["bufferView"]]
        o = bv.get("byteOffset", 0)
        open(f"{sys.argv[2]}_{i}.{im['mimeType'].split('/')[1]}", "wb").write(binb[o:o+bv["byteLength"]])
