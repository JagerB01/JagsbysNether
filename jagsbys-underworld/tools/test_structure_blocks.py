import unittest
from structure_crops import NBT
from structure_blocks import convert_structure_blocks, final_block


def block(name, states=None):
    return {'name': (8, name), 'states': (10, states or {}), 'version': (3, 18100737)}


def encoded(palette, indices, positions=None):
    root = {'format_version': (3, 1), 'size': (9, (3, [len(indices), 1, 1])),
            'structure': (10, {'block_indices': (9, (9, [(3, list(indices)), (3, [-1]*len(indices))])),
                              'entities': (9, (10, [{'identifier': (8, 'minecraft:villager_v2')}])),
                              'palette': (10, {'default': (10, {'block_palette': (9, (10, palette)),
                                                              'block_position_data': (10, positions or {})})})})}
    w = NBT();w.write('B', 10);w.put_string('');w.put(10, root)
    return w.stream.getvalue()


def decoded(data):
    r=NBT(data);r.read('B');r.string();return r.payload(10)


def marker(final):
    return (10, {'block_entity_data': (10, {'id': (8, 'JigsawBlock'), 'final_state': (8, final)})})


class StructureBlocks(unittest.TestCase):
    def test_village_torch_keeps_mounting_direction_and_entities(self):
        source=encoded([block('minecraft:redstone_torch', {'torch_facing_direction': (8, 'east')})], [0])
        result,stats=convert_structure_blocks(source,True)
        root=decoded(result);palette=root['structure'][1]['palette'][1]['default'][1]['block_palette'][1][1]
        self.assertEqual(palette[0],block('minecraft:soul_torch', {'torch_facing_direction': (8, 'east')}))
        self.assertEqual(stats['redstone_torches'],1)
        self.assertEqual(root['structure'][1]['entities'],decoded(source)['structure'][1]['entities'])
        self.assertEqual(convert_structure_blocks(result,True)[0],result)

    def test_farm_soul_sand_is_replaced_without_changing_other_blocks(self):
        source=encoded([block('minecraft:soul_sand'),block('minecraft:netherrack')],[0,1,0])
        result,stats=convert_structure_blocks(source,True,True)
        palette=decoded(result)['structure'][1]['palette'][1]['default'][1]['block_palette'][1][1]
        self.assertEqual(palette[0],block('minecraft:soul_soil'))
        self.assertEqual(palette[1],block('minecraft:netherrack'))
        self.assertEqual(stats['farm_soil'],2)
        self.assertEqual(convert_structure_blocks(result,True,True)[0],result)
        self.assertEqual(convert_structure_blocks(source,True)[0],source)

    def test_nonvillage_redstone_torches_are_unchanged(self):
        source=encoded([block('minecraft:redstone_torch', {'torch_facing_direction': (8, 'west')})], [0])
        self.assertEqual(convert_structure_blocks(source)[0],source)

    def test_java_stair_marker_resolves_to_bedrock_direction(self):
        source=encoded([block('minecraft:jigsaw')],[0],{'0':marker('minecraft:blackstone_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]')})
        result,stats=convert_structure_blocks(source);s=decoded(result)['structure'][1];d=s['palette'][1]['default'][1]
        i=s['block_indices'][1][1][0][1][0]
        self.assertEqual(d['block_palette'][1][1][i],block('minecraft:blackstone_stairs',{'weirdo_direction':(3,0),'upside_down_bit':(1,0)}))
        self.assertEqual(d['block_position_data'][1],{})
        self.assertEqual(stats['jigsaw_markers'],1)
        self.assertEqual(convert_structure_blocks(result)[0],result)

    def test_java_fence_gate_states_use_bedrock_names(self):
        self.assertEqual(final_block('minecraft:warped_fence_gate[facing=east,in_wall=false,open=false,powered=false]'),
                         ('minecraft:warped_fence_gate',{'direction':(3,3),'open_bit':(1,0),'in_wall_bit':(1,0)}))

    def test_structure_void_retains_existing_world_blocks(self):
        source=encoded([block('minecraft:jigsaw')],[0],{'0':marker('minecraft:structure_void')})
        result,_=convert_structure_blocks(source);s=decoded(result)['structure'][1]
        self.assertEqual(s['block_indices'][1][1][0][1],[-1])
        self.assertTrue(all(b['name'][1]!='minecraft:jigsaw' for b in s['palette'][1]['default'][1]['block_palette'][1][1]))

    def test_chest_inventory_survives_adjacent_marker_conversion(self):
        chest=(10,{'block_entity_data':(10,{'id':(8,'Chest'),'Items':(9,(10,[{'Name':(8,'minecraft:diamond'),'Count':(1,3)}]))})})
        source=encoded([block('minecraft:jigsaw'),block('minecraft:chest')],[0,1],{'0':marker('minecraft:netherrack'),'1':chest})
        result,_=convert_structure_blocks(source);s=decoded(result)['structure'][1]
        self.assertEqual(s['palette'][1]['default'][1]['block_position_data'][1]['1'],chest)
        self.assertEqual(s['block_indices'][1][1][0][1][1],1)


if __name__=='__main__':unittest.main()
