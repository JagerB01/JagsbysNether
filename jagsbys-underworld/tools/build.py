"""Merge the tested standalone releases into one BP/RP add-on without changing IDs."""
import argparse
import io
import json
import shutil
import struct
import subprocess
import zipfile
from pathlib import Path
from structure_crops import strip_wart
from structure_blocks import convert_structure_blocks
from structure_loot import populate_structure_containers

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
AGRICULTURE = REPO / 'downloads/Nether_Agriculture_v0.1.6.mcaddon'
SETTLEMENTS = REPO / 'downloads/Nether_Settlements_v0.8.24_CENTER_PALETTE.mcpack'
BUILD = ROOT / '.build'


def files(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert len(names) == len(set(names)), 'Duplicate archive paths'
        assert all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in names)
        return {n: archive.read(n) for n in names if not n.endswith('/')}


def archive_files(entries):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in sorted(entries):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, content, compresslevel=9)
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-placeholder-icon', action='store_true',
                        help='Local verification only: use the old crop icon while awaiting the supplied PNG.')
    args = parser.parse_args()
    # Bake encounter edits offline before copying the assets into the pack.
    subprocess.run(['python3', 'tools/update_campfire_candles.py'], cwd=ROOT, check=True)
    subprocess.run(['python3', 'tools/update_trial_encounters.py'], cwd=ROOT, check=True)
    subprocess.run(['python3', 'tools/update_dispenser_potions.py'], cwd=ROOT, check=True)
    subprocess.run(['python3', 'tools/update_structure_chests.py'], cwd=ROOT, check=True)
    addon = files(AGRICULTURE.read_bytes())
    agriculture = files(addon['Nether_Agriculture_BP.mcpack'])
    resources = files(addon['Nether_Agriculture_RP.mcpack'])
    settlements = files(SETTLEMENTS.read_bytes())
    icon_path = ROOT / 'pack_icon.png'
    placeholder = not icon_path.is_file()
    if placeholder and not args.allow_placeholder_icon:
        raise SystemExit('Missing pack_icon.png: attach the original cover PNG before making a release.')
    icon = agriculture['pack_icon.png'] if placeholder else icon_path.read_bytes()
    assert icon[:8] == b'\x89PNG\r\n\x1a\n', 'Pack cover must be a PNG'
    width, height = struct.unpack('>II', icon[16:24])
    assert width == height and width > 0, 'Pack cover must be square'
    if BUILD.exists():
        shutil.rmtree(BUILD)
    for directory in ('behavior_pack', 'resource_pack'):
        (BUILD / directory).mkdir(parents=True)
    combined = {}
    expected = {}
    crop_sites = {}
    changed_structures = set()
    block_conversions = {}
    source_edits = {}
    removed_assets = []
    for label, source in [('agriculture', agriculture), ('settlements', settlements)]:
        for name, content in source.items():
            if label == 'settlements' and 'large_farm' in name:
                removed_assets.append(name)
                continue
            if name in ('manifest.json', 'pack_icon.png'):
                continue
            if name.startswith('scripts/'):
                name = f'scripts/{label}/' + name.removeprefix('scripts/')
            elif '/' not in name:
                # Keep all provenance/license/history files, without root-name collisions.
                name = f'docs/{label}/' + name
            assert name not in combined, f'Asset collision: {name}'
            expected[name] = content
            if label == 'settlements' and b'large_farm' in content and name.endswith(('.js', '.json')):
                if name == 'scripts/settlements/catalog.js':
                    declarations = []
                    for line in content.decode().splitlines():
                        prefix, value = line.split(' = ', 1)
                        data = json.loads(value.rstrip(';'))
                        if prefix == 'export const catalog':
                            data = {key: item for key, item in data.items() if 'large_farm' not in key}
                        else:
                            data = {key: [item for item in entries if 'large_farm' not in item[0]] for key, entries in data.items()}
                        declarations.append(prefix + ' = ' + json.dumps(data, separators=(',', ':')) + ';')
                    content = ('\n'.join(declarations) + '\n').encode()
                else:
                    data = json.loads(content)
                    if name.startswith('features/'):
                        entries = data['minecraft:weighted_random_feature']['features']
                        data['minecraft:weighted_random_feature']['features'] = [item for item in entries if 'large_farm' not in item[0]]
                    else:
                        entries = data['minecraft:template_pool']['elements']
                        data['minecraft:template_pool']['elements'] = [item for item in entries if 'large_farm' not in item['element']['location']]
                    content = (json.dumps(data, indent=2) + '\n').encode()
                source_edits[name] = content
            if name.endswith('.mcstructure'):
                content, positions = strip_wart(content)
                content, conversion = convert_structure_blocks(content, '/villages/' in name, '/villages/' in name and '_farm_' in name)
                content, _ = populate_structure_containers(content)
                if any(conversion.values()):
                    block_conversions[name] = conversion
                if content != expected[name]:
                    changed_structures.add(name)
                if positions:
                    namespace, identifier = name.removeprefix('structures/').removesuffix('.mcstructure').split('/', 1)
                    crop_sites[f'{namespace}:{identifier}'] = positions
            combined[name] = content
    for name, content in combined.items():
        path = BUILD / 'behavior_pack' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    (BUILD / 'behavior_pack/scripts/settlements/crop_sites.js').write_text(
        'export const cropSites = ' + json.dumps(crop_sites, separators=(',', ':')) + ';\n')
    for name, content in resources.items():
        if name in ('manifest.json', 'pack_icon.png'):
            continue
        path = BUILD / 'resource_pack' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    for directory in ('behavior_pack', 'resource_pack'):
        for path in (ROOT / directory).rglob('*'):
            if path.is_file():
                target = BUILD / directory / path.relative_to(ROOT / directory)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(path.read_bytes())
        (BUILD / directory / 'pack_icon.png').write_bytes(icon)
    # Intentional population/generation overrides and wart-only structure edits.
    overrides = {'scripts/agriculture/main.js', 'scripts/settlements/population.js', 'scripts/settlements/main.js', 'scripts/settlements/sizing.js', 'scripts/settlements/navigation.js', 'scripts/settlements/terrain.js', 'scripts/settlements/accessible_search.js'}
    # Weighted pools and their matching roll probabilities are changed together
    # so interesting structures rise while marginal tent attempt rates stay fixed.
    for name in ('basalt', 'crimson_camp', 'warped_camp', 'soul', 'nether_brick', 'outpost'):
        overrides.add(f'features/{name}_weighted.json')
        overrides.add(f'feature_rules/{name}.json')
    for name, content in expected.items():
        if name in source_edits:
            assert (BUILD / 'behavior_pack' / name).read_bytes() == source_edits[name], name
            continue
        if name in overrides:
            assert (BUILD / 'behavior_pack' / name).read_bytes() == (ROOT / 'behavior_pack' / name).read_bytes()
            continue
        if name in changed_structures:
            rebuilt, _ = strip_wart(content)
            rebuilt, _ = convert_structure_blocks(rebuilt, '/villages/' in name, '/villages/' in name and '_farm_' in name)
            rebuilt, _ = populate_structure_containers(rebuilt)
            assert (BUILD / 'behavior_pack' / name).read_bytes() == rebuilt, name
            continue
        assert (BUILD / 'behavior_pack' / name).read_bytes() == content, name
    (BUILD / 'behavior_pack/CREDITS.txt').write_bytes((ROOT / 'CREDITS.txt').read_bytes())
    (BUILD / 'resource_pack/CREDITS.txt').write_bytes((ROOT / 'CREDITS.txt').read_bytes())
    for directory in ('behavior_pack', 'resource_pack'):
        (BUILD / directory / 'docs/lava_fishing/SOURCE_METADATA.json').write_bytes((ROOT / 'LAVA_FISHING_SOURCE.json').read_bytes())
    # Loose documents in a .mcaddon are treated as failed pack imports.
    docs = BUILD / 'behavior_pack/docs/underworld'
    docs.mkdir(parents=True, exist_ok=True)
    for name in ('TESTING.txt', 'GLOWSQUITO.md', 'INFERNAL_LORDS.md', 'INFERNAL_LORDS_SOURCE.json', 'BOSS_PLACEMENTS.json', 'TRIAL_ENCOUNTERS.json', 'FOOD_BUFFS.md', 'FISHING.md', 'HONGOS.md', 'HONGOS_SOURCE.json', 'SOUL_LIGHTS.md', 'GENERATION.md', 'VILLAGER_FOOD.md', 'CONQUEST_COMPATIBILITY.json', 'ARENAS.md', 'MOOGS_ARENAS_SOURCE.json', 'PERFORMANCE.md'):
        (docs / name).write_bytes((ROOT / name).read_bytes())
    shutil.copytree(ROOT / 'history', docs / 'history', dirs_exist_ok=True)
    (docs / 'SKITTERCHESTS.md').write_bytes((ROOT / 'SKITTERCHESTS.md').read_bytes())
    (docs / 'STRUCTURE_BLOCK_CONVERSIONS.json').write_text(json.dumps(block_conversions, indent=2) + '\n')
    assert not (BUILD / 'behavior_pack/entities/villager_v2.json').exists(), 'Food integration must not override C&C villagers'
    assert not (BUILD / 'resource_pack/entity/villager_v2.entity.json').exists()
    subprocess.run(['python3', 'tools/test_structure_blocks.py'], cwd=ROOT, check=True)
    subprocess.run(['python3', 'tools/test_structure_loot.py'], cwd=ROOT, check=True)
    subprocess.run(['python3', 'tools/test_moogs_arenas.py'], cwd=ROOT, check=True)
    subprocess.run(['python3', 'tools/test_natural_landmarks.py'], cwd=ROOT, check=True)
    subprocess.run(['python3', 'tools/validate.py'], cwd=ROOT, check=True)
    subprocess.run(['python3', 'tools/validate_infernal_lords.py', '--built'], cwd=ROOT, check=True)
    subprocess.run(['python3', 'tools/validate_boss_sites.py', '--built'], cwd=ROOT, check=True)
    subprocess.run(['node', '--import', './tests/register-mock.mjs', '--test',
                    *[str(p.relative_to(ROOT)) for p in sorted((ROOT / 'tests').glob('*.test.mjs'))]],
                   cwd=ROOT, check=True)
    packs = []
    for directory, suffix in [('behavior_pack', 'BP'), ('resource_pack', 'RP')]:
        entries = [(p.relative_to(BUILD / directory).as_posix(), p.read_bytes())
                   for p in (BUILD / directory).rglob('*') if p.is_file()]
        packs.append((f'Jagsbys_Underworld_{suffix}.mcpack', archive_files(entries)))
    version = json.loads((ROOT / 'behavior_pack/manifest.json').read_text())['header']['version']
    # A placeholder verification build stays local and cannot overwrite a release.
    output = BUILD / 'Jagsbys_Underworld_ICON_PENDING.mcaddon' if placeholder else \
        REPO / 'downloads' / f'Jagsbys_Underworld_v{".".join(map(str, version))}.mcaddon'
    output.write_bytes(archive_files(packs))
    check = files(output.read_bytes())
    assert set(check) == {'Jagsbys_Underworld_BP.mcpack', 'Jagsbys_Underworld_RP.mcpack'}, 'Only importable packs belong in the outer add-on archive'
    for suffix in ('BP', 'RP'):
        pack = files(check[f'Jagsbys_Underworld_{suffix}.mcpack'])
        assert pack['pack_icon.png'] == icon
        assert json.loads(pack['manifest.json'])['header']['version'] == version
    print(f'Preserved all {len(expected)-len(overrides)-len(changed_structures)-len(source_edits)} original behavior assets/scripts byte-for-byte (population/generation overridden; large farms removed; wart/lighting/jigsaw/loot conversion applied to {len(changed_structures)} structures); built {output} ({output.stat().st_size:,} bytes)')
    if placeholder:
        print('LOCAL VERIFICATION ONLY: user cover PNG still required; no release download was produced.')


if __name__ == '__main__':
    main()
