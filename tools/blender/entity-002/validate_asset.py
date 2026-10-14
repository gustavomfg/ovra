"""Check exported rig, texture ownership, motion weights and browser budgets."""
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[3]
REQUIRED = ["UMBRA_ROOT", "CTRL_BODY", "CTRL_LOOK", "CTRL_HEAD", "CTRL_EYE_L", "CTRL_EYE_R"]
for side in ("L", "R"):
    REQUIRED += [f"CTRL_{joint}_{side}" for joint in ("SHOULDER", "ELBOW", "WRIST")]
    REQUIRED += [f"CTRL_CLAW_{side}_{i}" for i in range(5)]


def validate(quality, triangle_budget, byte_budget):
    path = ROOT / f"public/3d/entity-002/umbra-{quality}.glb"
    data = path.read_bytes()
    magic, version, size = struct.unpack_from("<III", data)
    assert magic == 0x46546C67 and version == 2 and size == len(data), "Invalid GLB container"
    length, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20+length])
    names = {node.get("name") for node in doc["nodes"]}
    assert set(REQUIRED) <= names, f"Missing controls: {set(REQUIRED) - names}"
    primitives = [p for mesh in doc["meshes"] for p in mesh["primitives"]]
    triangles = sum(doc["accessors"][p["indices"]]["count"] // 3 for p in primitives)
    assert triangles <= triangle_budget and len(data) <= byte_budget, "Browser budget exceeded"
    assert len(primitives) <= 40, "Too many model draws"
    materials = {m["name"]: m for m in doc["materials"]}
    for name in ("M_Shadow", "M_Horn", "M_Tatter"):
        material = materials[name]
        assert "normalTexture" in material and "metallicRoughnessTexture" in material["pbrMetallicRoughness"], f"Missing baked PBR maps on {name}"
    for node in doc["nodes"]:
        if node.get("extras", {}).get("ovra_role") == "tatter" and "mesh" in node:
            for p in doc["meshes"][node["mesh"]]["primitives"]:
                assert "COLOR_0" in p["attributes"] and "TEXCOORD_0" in p["attributes"], "Missing cloth weights/UVs"
    assert all("uri" not in image for image in doc.get("images", [])), "Textures must be embedded for offline use"
    return {"quality": quality, "triangles": triangles, "model_draws": len(primitives), "bytes": len(data), "textures": len(doc.get("images", [])), "controls": len(REQUIRED)}


if __name__ == "__main__":
    print(json.dumps([validate("cinematic", 65000, 2500000), validate("optimized", 35000, 1800000)], indent=2))
