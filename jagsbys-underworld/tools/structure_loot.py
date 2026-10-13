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
    count = 0
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
        count += 1
    if not count:
        return data, count
    writer = NBT()
    writer.write('B', kind)
    writer.put_string(name)
    writer.put(kind, root)
    return writer.stream.getvalue(), count
