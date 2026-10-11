"""Check pack references and compatibility contracts before producing a download."""
import json
import struct
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def load(path):
    return json.loads(path.read_text())


def main():
    json_files = list(BP.rglob("*.json")) + list(RP.rglob("*.json"))
    for path in json_files:
        load(path)
    manifests = [load(BP / "manifest.json"), load(RP / "manifest.json")]
    uuids = [m["header"]["uuid"] for m in manifests] + [mod["uuid"] for m in manifests for mod in m["modules"]]
    assert len(set(uuids)) == len(uuids)
    for value in uuids:
        uuid.UUID(value)
    assert manifests[0]["dependencies"][0]["uuid"] == manifests[1]["header"]["uuid"]
    assert manifests[0]["dependencies"][0]["version"] == manifests[1]["header"]["version"]
    assert manifests[0]["dependencies"][1] == {"module_name": "@minecraft/server", "version": "2.0.0"}
    for path in BP.rglob("*.js"):
        subprocess.run(["node", "--check", str(path)], check=True)
    for manifest in manifests:
        for module in manifest["modules"]:
            if module["type"] == "script":
                assert (BP / module["entry"]).is_file()
    terrain = load(RP / "textures/terrain_texture.json")["texture_data"]
    icons = load(RP / "textures/item_texture.json")["texture_data"]
    for atlas in [terrain, icons]:
        for texture in atlas.values():
            assert (RP / (texture["textures"] + ".png")).is_file(), texture
    geometry = {g["description"]["identifier"] for g in load(RP / "models/blocks/nether_agriculture.geo.json")["minecraft:geometry"]}
    registered = {"jagsby_nether:crop", "jagsby_nether:farmland", "jagsby_nether:tillable_soil"}
    identifiers = set()
    blocks = {}
    for path in (BP / "blocks").glob("*.json"):
        block = load(path)["minecraft:block"]
        name = block["description"]["identifier"]
        assert name not in identifiers
        identifiers.add(name)
        blocks[name] = block
        components = [block["components"]] + [p["components"] for p in block.get("permutations", [])]
        for group in components:
            for key in group:
                if not key.startswith("minecraft:"):
                    assert key in registered, key
            if "minecraft:loot" in group:
                assert (BP / group["minecraft:loot"]).is_file()
            if "minecraft:geometry" in group:
                assert group["minecraft:geometry"] in geometry | {"minecraft:geometry.full_block"}
            for material in group.get("minecraft:material_instances", {}).values():
                assert material["texture"] in terrain or material["texture"] == "soul_soil", material
    for path in (BP / "items").glob("*.json"):
        item = load(path)["minecraft:item"]
        name = item["description"]["identifier"]
        assert name not in identifiers
        identifiers.add(name)
        c = item["components"]
        assert c["minecraft:icon"]["textures"]["default"] in icons
        if "minecraft:block_placer" in c:
            assert c["minecraft:block_placer"]["block"] in blocks
        if "minecraft:food" in c:
            assert "minecraft:use_modifiers" in c
    def references(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ("item", "name", "input", "output") and isinstance(child, str) and child.startswith("jagsby_nether:"):
                    assert child in identifiers, child
                references(child)
        elif isinstance(value, list):
            for child in value:
                references(child)
    recipes = list((BP / "recipes").glob("*.json"))
    for path in recipes:
        recipe = load(path)
        for kind in ("minecraft:recipe_shaped", "minecraft:recipe_shapeless"):
            if kind in recipe:
                # Bedrock's AlwaysUnlocked context is an object, not an item array.
                assert recipe[kind].get("unlock") == {"context": "AlwaysUnlocked"}, path
    assert load(RP / "blocks.json")["jagsby_nether:soul_soil_farmland"]["sound"] == "soul_soil"
    farmland = blocks["jagsby_nether:soul_soil_farmland"]
    assert farmland["description"]["states"]["jagsby_nether:heat_level"] == list(range(8))
    assert farmland["description"]["states"]["jagsby_nether:idle_steps"] == list(range(16))
    assert farmland["components"]["minecraft:tick"] == {"interval_range": [40, 40], "looping": True}
    for g in load(RP / "models/blocks/nether_agriculture.geo.json")["minecraft:geometry"]:
        if g["description"]["identifier"] == "geometry.jagsby_nether.farmland":
            continue
        for bone in g["bones"]:
            for cube in bone.get("cubes", []):
                assert cube["size"][2] > 0, "Coplanar front/back crop faces can flicker"
    for path in recipes + list((BP / "loot_tables").rglob("*.json")):
        references(load(path))
    assert set(load(RP / "blocks.json")) - {"format_version"} == set(blocks)
    for path in RP.rglob("*.png"):
        data = path.read_bytes()
        assert data[:8] == b"\x89PNG\r\n\x1a\n"
        width, height = struct.unpack(">II", data[16:24])
        assert width > 0 and height > 0
    assert not any("agricultureprogression:" in p.read_text() for p in json_files)
    print(f"Validated {len(json_files)} JSON files, {len(blocks)} blocks, "
          f"{len(identifiers) - len(blocks)} items, {len(recipes)} recipes, textures and script syntax")


if __name__ == "__main__":
    main()
