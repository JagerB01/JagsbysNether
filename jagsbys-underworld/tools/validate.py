"""Check pack references and compatibility contracts before producing a download."""
import json
import hashlib
import struct
import subprocess
import uuid
from pathlib import Path
from structure_crops import strip_wart

ROOT = Path(__file__).resolve().parents[1]
BP, RP = ROOT / ".build/behavior_pack", ROOT / ".build/resource_pack"


def load(path):
    return json.loads(path.read_text())


def main():
    structure_count = 0
    for path in (BP / 'structures').rglob('*.mcstructure'):
        sanitized, wart = strip_wart(path.read_bytes())
        assert not wart and sanitized == path.read_bytes(), f'Nether wart remains: {path}'
        structure_count += 1
    assert structure_count > 0
    print(f'Checked {structure_count} structure palettes: no nether wart')
    json_files = list(BP.rglob("*.json")) + list(RP.rglob("*.json"))
    for path in json_files:
        load(path)
    manifests = [load(BP / "manifest.json"), load(RP / "manifest.json")]
    uuids = [m["header"]["uuid"] for m in manifests] + [mod["uuid"] for m in manifests for mod in m["modules"]]
    assert len(set(uuids)) == len(uuids)
    for value in uuids:
        uuid.UUID(value)
    version = load(ROOT / "behavior_pack/manifest.json")["header"]["version"]
    for manifest in manifests:
        assert manifest["header"]["version"] == version
        assert manifest["header"]["name"].startswith("Jagsby's Underworld v" + ".".join(map(str, version)))
        assert all(m["version"] == version for m in manifest["modules"])
    scripts = [m for m in manifests[0]["modules"] if m["type"] == "script"]
    assert len(scripts) == 1 and scripts[0]["entry"] == "scripts/main.js"
    assert (BP / "pack_icon.png").read_bytes() == (RP / "pack_icon.png").read_bytes()
    for path in [BP / "docs/settlements/LICENSE.txt", BP / "docs/agriculture/ORIGINAL_LICENSE.txt"]:
        assert path.is_file(), path
    assert manifests[0]["dependencies"][0]["uuid"] == manifests[1]["header"]["uuid"]
    assert manifests[0]["dependencies"][0]["version"] == manifests[1]["header"]["version"]
    assert manifests[0]["dependencies"][1] == {"module_name": "@minecraft/server", "version": "2.0.0"}
    for path in BP.rglob("*.js"):
        subprocess.run(["node", "--check", str(path)], check=True)
    for manifest in manifests:
        for module in manifest["modules"]:
            if module["type"] == "script":
                assert (BP / module["entry"]).is_file()
    subprocess.run(["node", "--input-type=module", "-e", """
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {catalog,pools} from './.build/behavior_pack/scripts/settlements/catalog.js';
import {roadMaterial} from './.build/behavior_pack/scripts/settlements/road_material.js';
for (const piece of Object.values(catalog)) {
    const [ns,path] = piece.id.split(':');
    assert(existsSync(`.build/behavior_pack/structures/${ns}/${path}.mcstructure`), piece.id);
}
for (const entries of Object.values(pools)) for (const [key] of entries) assert(catalog[key], key);
let smooth = 0;
for (let x=-128;x<128;x++) for (let z=-128;z<128;z++) {
    if (roadMaterial(x,z)==='minecraft:smooth_basalt') smooth++;
}
assert(smooth/65536 > 0.19 && smooth/65536 < 0.21);
console.log(`Resolved ${Object.keys(catalog).length} settlement assets, ${Object.keys(pools).length} pools and 20% material selection`);
"""], cwd=ROOT, check=True)
    # Validate the entire scoped fishing asset set and its client references.
    metadata = load(ROOT / 'LAVA_FISHING_SOURCE.json')
    for source, expected_hash in metadata['assets_sha256'].items():
        name = Path(source).name
        if '/textures/item/' in source:
            target = RP / 'textures/items/lava_fishing' / name
        elif '/textures/entity/' in source:
            target = RP / 'textures/entity/lava_fishing' / name
        elif '/geo/' in source:
            target = RP / 'models/entity/lava_fishing' / name
        else:
            name = 'nether_fish.json' if '/nether/' in source else 'lava_fish.json' if '/lava/' in source else name
            target = BP / 'docs/lava_fishing/source_data' / name
        assert hashlib.sha256(target.read_bytes()).hexdigest() == expected_hash, target
    geometries = {g['description']['identifier'] for p in (RP / 'models').rglob('*.json')
                  for g in load(p).get('minecraft:geometry', [])}
    for path in (RP / 'entity/lava_fishing').glob('*.json'):
        client = load(path)['minecraft:client_entity']['description']
        assert (BP / 'entities/lava_fishing' / (path.name.replace('.entity.json', '.json'))).is_file()
        assert all(identifier == 'geometry.fishing_hook' or identifier in geometries for identifier in client['geometry'].values()), path
        assert all(texture == 'textures/entity/fishhook' or (RP / (texture + '.png')).is_file() for texture in client['textures'].values()), path
    fish_ids = {'flame_squat_lobster', 'obsidian_sword_fish', 'steam_flying_fish', 'agni_fish',
                'arowana_fish', 'quartz_fish', 'scaly_foot_snail', 'yeti_crab', 'lava_lamprey'}
    fishing_items = {p.stem for p in (BP / 'items/lava_fishing').glob('*.json')}
    assert fishing_items == fish_ids | {'obsidian_fishing_rod'}
    rod = load(BP / 'items/lava_fishing/obsidian_fishing_rod.json')['minecraft:item']['components']
    assert rod['minecraft:durability']['max_durability'] == 256
    assert rod['minecraft:max_stack_size'] == 1
    assert 'jagsby_nether:lava_fishing_rod' in rod
    assert {p.name for p in (BP / 'entities/lava_fishing').glob('*.json')} == {'lava_bobber.json'}
    assert {p.name for p in (RP / 'entity/lava_fishing').glob('*.json')} == {'lava_bobber.entity.json'}
    assert not list((BP / 'loot_tables/entities/lava_fishing').glob('*.json'))
    assert not list((RP / 'textures/entity/lava_fishing').glob('*.png'))
    for fish in fish_ids:
        assert not (BP / f'entities/lava_fishing/{fish}.json').exists()
    print(f'Validated {len(metadata["assets_sha256"])} exact Java fishing assets/data files, nine fish and one rod')

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
    for path in (BP / "items").rglob("*.json"):
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
    # Bedrock preserves JSON integer/float token types when loading actor properties.
    # An integer default on a float rejects the entire property component.
    bobber = load(BP / "entities/lava_fishing/lava_bobber.json")["minecraft:entity"]
    for name, prop in bobber["description"]["properties"].items():
        if prop["type"] == "float":
            assert isinstance(prop["default"], float), f"Float property needs a decimal default: {name}"
            assert all(isinstance(n, float) for n in prop["range"]), name
    assert bobber["components"]["minecraft:damage_sensor"]["triggers"][0]["deals_damage"] == "no"
    for entity in [bobber, load(BP / "entities/crop_biome_probe.json")["minecraft:entity"]]:
        for event in entity["events"]["jagsby_nether:classify"]["sequence"]:
            assert all(f["test"] == "has_biome_tag" for f in event["filters"]["any_of"])
    def references(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ("item", "name", "input", "output") and isinstance(child, str) and child.startswith("jagsby_nether:"):
                    assert child in identifiers, child
                references(child)
        elif isinstance(value, list):
            for child in value:
                references(child)
    recipes = list((BP / "recipes").rglob("*.json"))
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
