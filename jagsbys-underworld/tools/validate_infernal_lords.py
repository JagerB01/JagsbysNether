"""Validate the scoped Dungeons integration without needing either source pack installed."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return json.loads(path.read_text())

def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)

def validate(bp, rp):
    source = read(ROOT / 'INFERNAL_LORDS_SOURCE.json')
    for key, record in source['files'].items():
        pack, relative = key.split('/', 1)
        path = (bp if pack == 'BP' else rp) / relative
        assert path.is_file(), f'Missing imported asset: {key}'
        assert hashlib.sha256(path.read_bytes()).hexdigest() == record['integrated_sha256'], f'Changed imported asset without source note: {key}'
    ids = set(read(bp / 'scripts/infernal_lords/entity_ids.json'))
    actors = {}
    for path in (bp / 'entities').rglob('*.json'):
        entity = read(path)['minecraft:entity']
        identifier = entity['description']['identifier']
        assert identifier not in actors, f'Duplicate BP actor: {identifier}'
        actors[identifier] = entity
    assert ids <= actors.keys()
    assert 'dungeons:ancient_terror' not in actors
    assert not any(identifier.startswith('minecraft:') for identifier in ids)
    for identifier, hp in [('nameless_one',600),('wretched_wraith',500),('boss_wildfire',500),('tower_wraith',36),('necromancer',50)]:
        entity = actors['dungeons:'+identifier]
        assert entity['components']['minecraft:health'] == {'value': hp, 'max': hp}
    routes = json.loads((bp / 'scripts/infernal_lords/boss_event_routes.js').read_text().split(' = ',1)[1].rstrip(';\n'))
    for identifier, events in routes.items():
        for event in events:
            command = 'scriptevent jagsby_nether:boss_event ' + event
            commands = actors[identifier]['events'][event]['queue_command']['command']
            assert commands.count(command) == 1, f'{identifier}: missing/duplicate native command bridge for {event}'
    for actor, event in [('necromancer_spawnpoint', 'dungeons:zombie'), ('tower_wraith_poison', 'minecraft:entity_spawned'), ('wraith_fire', 'dungeons:spawn_tower_wraith_fire'), ('wraith_fire', 'dungeons:wraith_fire_hit')]:
        assert event in routes['dungeons:'+actor], f'{actor}: missing reliable ability event bridge'
    fire = actors['dungeons:wraith_fire']['components']
    assert 'minecraft:behavior.timer_flag_1' not in fire
    assert fire['minecraft:entity_sensor']['subsensors'][0]['event'] == 'dungeons:wraith_fire_hit'
    assert 'on_ground' not in json.dumps(fire['minecraft:environment_sensor']), 'Collisionless fire must not despawn for lacking ground contact'
    server_animations = set()
    for folder, key in [('animations','animations'), ('animation_controllers','animation_controllers')]:
        for path in (bp / folder).rglob('*.json'):
            server_animations.update(read(path).get(key, {}))
    for identifier in ids:
        for reference in actors[identifier]['description'].get('animations', {}).values():
            assert reference in server_animations, f'{identifier}: missing server animation/controller {reference}'
    for identifier in ('nameless_one','nameless_one_resting','wretched_wraith','wretched_wraith_resting','boss_wildfire','boss_wildfire_resting'):
        entity = actors['dungeons:'+identifier]
        assert 'minecraft:fire_immune' in entity['components'], identifier
        for components in [entity['components'], *entity.get('component_groups', {}).values()]:
            if 'minecraft:damage_sensor' not in components:
                continue
            triggers = components['minecraft:damage_sensor']['triggers']
            for cause in ('fire','fire_tick','lava'):
                assert any(t.get('cause') == cause and t.get('deals_damage') == 'no' for t in triggers), f'{identifier}: vulnerable to {cause}'
    for name in ('nameless_one','wretched_wraith'):
        projectile = actors['dungeons:'+name+'_projectile']['components']['minecraft:projectile']
        assert projectile['on_hit']['impact_damage']['damage'] > 0, f'{name}: no native projectile damage'
        assert 'remove_on_hit' in projectile['on_hit']
    for name, phases in [('wretched_wraith', ('ranged_attacking','bullethell_windup','bullethell_attacking')), ('boss_wildfire', ('shockwave_action','shockwave_recovery','shockwave_cooldown')), ('nameless_one', ('summon_cooldown','summon_cooldown_short'))]:
        for phase in phases:
            group = actors['dungeons:'+name]['component_groups']['dungeons:'+phase]
            assert 'minecraft:timer' in group, f'{name}/{phase}: needs AI-independent phase timer'
            assert not any(k.startswith('minecraft:behavior.timer_flag_') for k in group), f'{name}/{phase}: AI goal timer reintroduced'
    for identifier in ('necromancer','tower_wraith','frozen_zombie'):
        base = actors['dungeons:'+identifier]['components']
        enchanted = actors['dungeons:enchanted_'+identifier]['components']
        assert enchanted['minecraft:health']['max'] == base['minecraft:health']['max'] * 2
        assert abs(enchanted['minecraft:scale']['value'] / base.get('minecraft:scale',{'value':1})['value'] - 1.1) < 1e-9
        assert abs(enchanted['minecraft:knockback_resistance']['value'] - base.get('minecraft:knockback_resistance',{'value':0})['value'] - 0.2) < 1e-9
    for key in source['files']:
        if not key.startswith('BP/'):
            continue
        path = bp / key[3:]
        if path.suffix not in ('.js', '.json'):
            continue
        text = path.read_text()
        for target in re.findall(r'(?:"(?:entity_type|spawn_entity|into)"\s*:\s*"|summon\s+|spawnEntity\([\'"])(dungeons:[\w_]+)', text):
            assert target in ids, f'{path}: missing actor {target}'
        for table in re.findall(r'loot_tables/[\w/]+\.json', text):
            assert (bp / table).is_file() or table in source['native_loot_tables'], f'{path}: {table}'
    definitions = set()
    documents = []
    for key in source['files']:
        if not key.startswith('RP/') or not key.endswith('.json'):
            continue
        doc = read(rp / key[3:]); documents.append((key,doc))
        for group in ('animations','animation_controllers','render_controllers'):
            for identifier in doc.get(group, {}):
                assert identifier not in definitions, f'Duplicate client definition {identifier}'
                definitions.add(identifier)
        definitions.update(key for key in doc if key.startswith('geometry.'))
        for geometry in doc.get('minecraft:geometry', []):
            definitions.add(geometry['description']['identifier'])
        if 'particle_effect' in doc:
            definitions.add(doc['particle_effect']['description']['identifier'])
    # Vanilla humanoid/arrow resources intentionally resolve from Bedrock itself.
    native_prefixes = ('animation.humanoid.', 'controller.animation.humanoid.', 'animation.common.', 'animation.skeleton.', 'animation.zombie.', 'controller.animation.zombie.', 'animation.spear.', 'animation.blaze.', 'controller.animation.blaze.')
    native = {'controller.render.default','controller.render.arrow','geometry.arrow','geometry.zombie.v1.8','geometry.zombie.baby','geometry.spear','geometry.fireball','geometry.default','controller.render.armor','controller.render.fireball','controller.render.item_default','controller.render.zombie.v2','animation.actor.billboard','geometry.blaze','controller.render.blaze'}
    for key, doc in documents:
        values = list(strings(doc))
        for value in values:
            for identifier in re.findall(r'(?:animation\.[\w.]+|controller\.(?:animation|render)\.[\w.]+|geometry\.[\w.]+)', value):
                assert identifier in definitions or identifier in native or identifier.startswith(native_prefixes), f'{key}: {identifier}'
            if value.startswith('textures/') and not any(c in value for c in ' ;\n'):
                assert any((rp / (value + ext)).is_file() for ext in ('','.png','.tga')) or value in source['native_textures'], f'{key}: missing {value}'
    # Custom shader and PBR dependencies must be present, not silently treated as native.
    materials = {}
    for path in (rp / 'materials').glob('*.material'):
        materials.update(read(path).get('materials', {}))
    assert 'underworld_dungeons_enchant:entity_static' in materials
    for key, doc in documents:
        description = doc.get('minecraft:client_entity',{}).get('description',{})
        for material in description.get('materials',{}).values():
            if material.startswith('underworld_dungeons_'):
                assert any(name.split(':')[0] == material for name in materials), material
        if 'minecraft:texture_set' in doc:
            folder = (rp / key[3:]).parent
            for value in doc['minecraft:texture_set'].values():
                if isinstance(value,str):
                    assert (folder / (value+'.png')).is_file(), f'{key}: {value}'
    assert 'geometry.arrow' not in definitions, 'Do not override vanilla arrow geometry'
    for identifier in source['dynamic_particles']:
        assert identifier in definitions, identifier
    sounds = read(rp / 'sounds/sound_definitions.json')['sound_definitions']
    for identifier in source['required_sound_events']:
        assert identifier in sounds, identifier
        for sound in sounds[identifier]['sounds']:
            name = sound if isinstance(sound,str) else sound['name']
            assert any((rp / (name+ext)).is_file() for ext in ('','.ogg','.wav')), name
    language = (rp / 'texts/en_US.lang').read_text()
    for key in ('nameless_one','wretched_wraith','wretched_wraith_immune','hovering_inferno'):
        assert 'dungeons.bossbar.'+key+'=' in language, key
    for identifier, name in [('nameless_one','Malzareth, Lord of Decay'),('wretched_wraith','Nerezhal, Lord of Lamentation'),('boss_wildfire','Baelgor, Lord of Ruin'),('tower_wraith','Ashen Tower Wraith'),('necromancer','Crimson Necromancer')]:
        assert 'entity.dungeons:'+identifier+'.name='+name+'\n' in language, identifier
    for key in source['files']:
        if key.startswith('BP/items/'):
            item = read(bp / key[3:])['minecraft:item']
            label = item['components']['minecraft:display_name']['value']
            assert label+'=' in language, label
    for identifier in ('nameless_one','wretched_wraith','boss_wildfire'):
        assert 'chests/underworld_structure' in (bp / f'functions/loot/{identifier}.mcfunction').read_text()
    for boss, drop in [('nameless_one','withered_heart'),('wretched_wraith','weeping_soul'),('boss_wildfire','ruinous_ember')]:
        table_path = f'loot_tables/entities/{boss}.json'
        assert actors['dungeons:'+boss]['components']['minecraft:loot']['table'] == table_path
        table = read(bp / table_path)
        assert not table.get('conditions'), f'{boss}: drop cannot depend on a kill condition'
        matches = [pool for pool in table['pools'] if any(entry.get('name') == 'jagsby_nether:'+drop for entry in pool.get('entries',[]))]
        assert len(matches) == 1, f'{boss}: exactly one guaranteed ingredient pool'
        pool = matches[0]
        assert pool['rolls'] == 1 and not pool.get('conditions') and len(pool['entries']) == 1
        entry = pool['entries'][0]
        assert entry['type'] == 'item' and not entry.get('conditions')
        assert entry['functions'] == [{'function':'set_count','count':1}], f'{boss}: no Looting multiplier or variable quantity'
    assert all(not list((bp / 'spawn_rules').rglob(f'*{name}*')) for name in ('nameless','wretched','wildfire','necromancer','tower_wraith'))
    print(f'Infernal Lords: verified {len(ids)} scoped actors, {len(source["files"])} assets, {len(source["required_sound_events"])} recorded custom sounds')

if __name__ == '__main__':
    import sys
    base = ROOT / '.build' if '--built' in sys.argv else ROOT
    validate(base / 'behavior_pack', base / 'resource_pack')
