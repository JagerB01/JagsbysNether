"""Resolve imported jigsaw markers and village lighting without rebuilding NBT."""
from structure_crops import NBT


def final_block(value):
    name, _, suffix = value.partition('[')
    props = dict(part.split('=', 1) for part in suffix.rstrip(']').split(',') if part)
    if name == 'minecraft:structure_void':
        assert not props, value
        return None  # Bedrock -1 structure index means retain the world's block.
    states = {}
    if name.endswith('_stairs'):
        assert set(props) <= {'facing', 'half', 'shape', 'waterlogged'}, value
        assert props.get('shape', 'straight') == 'straight' and props.get('waterlogged', 'false') == 'false', value
        states = {'weirdo_direction': (3, {'east': 0, 'west': 1, 'south': 2, 'north': 3}[props.get('facing', 'north')]),
                  'upside_down_bit': (1, int(props.get('half', 'bottom') == 'top'))}
    elif name.endswith('_fence_gate'):
        assert set(props) <= {'facing', 'in_wall', 'open', 'powered'}, value
        states = {'direction': (3, {'south': 0, 'west': 1, 'north': 2, 'east': 3}[props.get('facing', 'north')]),
                  'open_bit': (1, int(props.get('open', 'false') == 'true')),
                  'in_wall_bit': (1, int(props.get('in_wall', 'false') == 'true'))}
    elif name == 'minecraft:barrel':
        assert not props, value
        states = {'facing_direction': (3, 2), 'open_bit': (1, 0)}
    else:
        assert not props, f'Unrecognized Java final-state properties: {value}'
    return name, states


def convert_structure_blocks(data, village=False):
    reader = NBT(data)
    kind, name = reader.read('B'), reader.string()
    assert kind == 10
    root = reader.payload(kind)
    assert reader.stream.read() == b''
    structure = root['structure'][1]
    default = structure['palette'][1]['default'][1]
    palette = default['block_palette'][1][1]
    positions = default.get('block_position_data', (10, {}))[1]
    layers = structure['block_indices'][1][1]
    markers = {i for i, b in enumerate(palette) if b['name'][1] == 'minecraft:jigsaw'}
    torches = {i for i, b in enumerate(palette) if village and b['name'][1] in
               ('minecraft:redstone_torch', 'minecraft:unlit_redstone_torch')}
    stats = {'jigsaw_markers': 0, 'redstone_torches': 0}
    changed = bool(markers or torches)
    for _, indices in layers:
        for index, block_index in enumerate(indices):
            if block_index in torches:
                stats['redstone_torches'] += 1
            if block_index not in markers:
                continue
            entity = positions[str(index)][1]['block_entity_data'][1]
            assert entity['id'][1].startswith('Jigsaw'), entity
            result = final_block(entity['final_state'][1])
            if result is None:
                indices[index] = -1
            else:
                replacement = dict(palette[block_index])
                replacement['name'] = (8, result[0])
                replacement['states'] = (10, result[1])
                # Keep the source Bedrock palette version: directional legacy
                # states match that format and upgrade normally in current clients.
                if replacement not in palette:
                    palette.append(replacement)
                indices[index] = palette.index(replacement)
            stats['jigsaw_markers'] += 1
    for i in torches:
        palette[i]['name'] = (8, 'minecraft:soul_torch')
        # Both Bedrock torch types use the same torch_facing_direction state.
    for i in markers:
        palette[i]['name'] = (8, 'minecraft:air')
        palette[i]['states'] = (10, {})
    # The static catalog retains connectors for planning. Technical block-entity
    # data, including stale unused jigsaw entries, is not needed in placed NBT.
    for index, entry in list(positions.items()):
        entity = entry[1].get('block_entity_data', (10, {}))[1]
        if entity.get('id', (8, ''))[1].startswith('Jigsaw'):
            del entry[1]['block_entity_data']
            if not entry[1]:
                del positions[index]
            changed = True
    if not changed:
        return data, stats
    writer = NBT()
    writer.write('B', kind)
    writer.put_string(name)
    writer.put(kind, root)
    return writer.stream.getvalue(), stats
