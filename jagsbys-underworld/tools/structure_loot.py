"""Attach native randomized loot to empty imported structure containers."""
from structure_crops import NBT

LOOT_TABLE = 'loot_tables/chests/underworld_structure.json'
CONTAINERS = {'minecraft:chest': 'Chest', 'minecraft:trapped_chest': 'Chest', 'minecraft:barrel': 'Barrel'}


def populate_structure_containers(data):
    reader = NBT(data)
    kind, name = reader.read('B'), reader.string()
    assert kind == 10
    root = reader.payload(kind)
    assert not reader.stream.read()
    size = root['size'][1][1]
    structure = root['structure'][1]
    default = structure['palette'][1]['default'][1]
    palette = default['block_palette'][1][1]
    positions = default.setdefault('block_position_data', (10, {}))[1]
    changed = set()
    # Container blocks belong in the primary layer; ignore secondary liquid data.
    indices = structure['block_indices'][1][1][0][1]
    for index, block_index in enumerate(indices):
        if block_index < 0:
            continue
        entity_id = CONTAINERS.get(palette[block_index]['name'][1])
        if not entity_id:
            continue
        existing = positions.get(str(index), (10, {}))[1]
        entity = existing.get('block_entity_data', (10, {}))[1]
        # Never replace intentional contents or an existing loot table.
        if entity.get('LootTable', (8, ''))[1] or entity.get('Items', (9, (10, [])))[1][1]:
            continue
        x, remainder = divmod(index, size[1] * size[2])
        y, z = divmod(remainder, size[2])
        entity.update({'id': (8, entity_id), 'x': (3, x), 'y': (3, y), 'z': (3, z),
                       'isMovable': (1, 1), 'LootTable': (8, LOOT_TABLE)})
        entity.pop('LootTableSeed', None)  # Each placement rolls independently.
        existing['block_entity_data'] = (10, entity)
        positions[str(index)] = (10, existing)
        changed.add((id(root), str(index)))
    changed.update(pair_chest_records(chest_records(root)))
    if not changed:
        return data, 0
    writer = NBT()
    writer.write('B', kind)
    writer.put_string(name)
    writer.put(kind, root)
    return writer.stream.getvalue(), len(changed)


def chest_records(root, offset=(0, 0, 0)):
    """Locate only authored chest entities; no world/runtime scans."""
    sx, sy, sz = root['size'][1][1]
    structure = root['structure'][1]
    default = structure['palette'][1]['default'][1]
    palette = default['block_palette'][1][1]
    layer = structure['block_indices'][1][1][0][1]
    records = {}
    for key, entry in default['block_position_data'][1].items():
        index = int(key)
        pi = layer[index]
        if pi < 0 or palette[pi]['name'][1] not in ('minecraft:chest', 'minecraft:trapped_chest'):
            continue
        entity = entry[1].get('block_entity_data', (10, {}))[1]
        if entity.get('id') != (8, 'Chest'):
            continue
        x, rem = divmod(index, sy * sz)
        y, z = divmod(rem, sz)
        records[(x + offset[0], y + offset[1], z + offset[2])] = {
            'entity': entity, 'block': palette[pi], 'local': (x, y, z), 'offset': offset,
            'index': key, 'root': root,
        }
    return records


def chest_facing(block):
    states = block['states'][1]
    cardinal = states.get('minecraft:cardinal_direction', (8, ''))[1]
    return {'north': 2, 'south': 3, 'west': 4, 'east': 5}.get(cardinal, states.get('facing_direction', (3, 2))[1])


def pair_chest_records(records):
    """Restore reciprocal Bedrock pairing, including across placement tiles.

    Neighbor coordinates use the same saved coordinate frame as each chest's
    own x/z fields. The native structure loader handles world translation and
    rotation; a companion outside a tile remains a legitimate adjacent pair.
    Ambiguous triples, barrels, opposite-facing and unlike chest types skip.
    """
    def neighbors(position):
        record = records[position]
        block = record['block']
        facing = chest_facing(block)
        axes = ((1, 0), (-1, 0)) if facing in (2, 3) else ((0, 1), (0, -1)) if facing in (4, 5) else ()
        x, y, z = position
        return [p for dx, dz in axes if (p := (x + dx, y, z + dz)) in records
                and records[p]['block']['name'] == block['name']
                and chest_facing(records[p]['block']) == facing]
    changed = set()
    visited = set()
    for position in sorted(records):
        if position in visited:
            continue
        adjacent = neighbors(position)
        if len(adjacent) != 1 or neighbors(adjacent[0]) != [position]:
            continue
        partner = adjacent[0]
        for own, other in ((position, partner), (partner, position)):
            record = records[own]
            entity = record['entity']
            x, _, z = record['local']
            frame_x = entity.get('x', (3, x))[1] - x
            frame_z = entity.get('z', (3, z))[1] - z
            fields = {'pairx': (3, other[0] - record['offset'][0] + frame_x),
                      'pairz': (3, other[2] - record['offset'][2] + frame_z),
                      'pairlead': (1, int(own < other))}
            if any(entity.get(key) != value for key, value in fields.items()):
                entity.update(fields)
                changed.add((id(record['root']), record['index']))
        visited.update((position, partner))
    # Clear a known invalid old link, while preserving links to companions
    # outside a single-file repair and valid explicit pairs beside a third chest.
    for position, record in records.items():
        entity = record['entity']
        if position in visited or 'pairx' not in entity or 'pairz' not in entity:
            continue
        x, _, z = record['local']
        fx = entity.get('x', (3, x))[1] - x
        fz = entity.get('z', (3, z))[1] - z
        partner = (entity['pairx'][1] + record['offset'][0] - fx, position[1],
                   entity['pairz'][1] + record['offset'][2] - fz)
        if partner in records and partner not in neighbors(position):
            for field in ('pairx', 'pairz', 'pairlead'):
                entity.pop(field, None)
            changed.add((id(record['root']), record['index']))
    return changed
