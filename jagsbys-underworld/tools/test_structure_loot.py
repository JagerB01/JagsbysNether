import unittest
from test_structure_blocks import block, encoded, decoded
from structure_loot import populate_structure_containers, LOOT_TABLE

class StructureLoot(unittest.TestCase):
    def test_empty_chest_and_barrel_receive_native_loot(self):
        source=encoded([block('minecraft:chest'),block('minecraft:barrel'),block('minecraft:stone')],[0,1,2])
        output,count=populate_structure_containers(source)
        self.assertEqual(count,2)
        positions=decoded(output)['structure'][1]['palette'][1]['default'][1]['block_position_data'][1]
        for index,id in [('0','Chest'),('1','Barrel')]:
            e=positions[index][1]['block_entity_data'][1]
            self.assertEqual(e['id'][1],id)
            self.assertEqual(e['LootTable'][1],LOOT_TABLE)
            self.assertEqual(e['x'][1],int(index))
            self.assertNotIn('LootTableSeed',e)
        self.assertEqual(populate_structure_containers(output),(output,0))

    def test_existing_items_or_loot_are_preserved(self):
        for entity in [{'Items':(9,(10,[{'Name':(8,'minecraft:diamond'),'Count':(1,2)}]))}, {'LootTable':(8,'loot_tables/chests/other.json')}]:
            source=encoded([block('minecraft:chest')],[0],{'0':(10,{'block_entity_data':(10,entity)})})
            self.assertEqual(populate_structure_containers(source),(source,0))

    def test_double_chest_halves_keep_independent_loot_and_reciprocal_native_links(self):
        source=encoded([block('minecraft:chest',{'minecraft:cardinal_direction':(8,'north')})],[0,0])
        output,count=populate_structure_containers(source);self.assertEqual(count,2)
        positions=decoded(output)['structure'][1]['palette'][1]['default'][1]['block_position_data'][1]
        a=positions['0'][1]['block_entity_data'][1];b=positions['1'][1]['block_entity_data'][1]
        self.assertEqual((a['pairx'][1],b['pairx'][1]),(1,0));self.assertEqual((a['pairz'][1],b['pairz'][1]),(0,0));self.assertEqual((a['pairlead'][1],b['pairlead'][1]),(1,0))
        self.assertEqual(a['LootTable'][1],LOOT_TABLE);self.assertEqual(b['LootTable'][1],LOOT_TABLE)
        self.assertEqual(populate_structure_containers(output),(output,0))

    def test_tile_boundary_pair_links_are_local_to_each_placement_origin(self):
        from structure_loot import chest_records,pair_chest_records
        roots=[decoded(populate_structure_containers(encoded([block('minecraft:chest')],[0]))[0]) for _ in range(2)]
        records={**chest_records(roots[0],(15,0,0)),**chest_records(roots[1],(16,0,0))}
        self.assertEqual(len(pair_chest_records(records)),2)
        a=records[(15,0,0)]['entity'];b=records[(16,0,0)]['entity']
        self.assertEqual(a['pairx'][1],1);self.assertEqual(b['pairx'][1],-1)
        self.assertEqual(pair_chest_records(records),set())

    def test_modern_west_facing_chests_pair_across_z_tile_seams(self):
        from structure_loot import chest_records,pair_chest_records
        roots=[decoded(populate_structure_containers(encoded([block('minecraft:chest',{'minecraft:cardinal_direction':(8,'west')})],[0]))[0]) for _ in range(2)]
        records={**chest_records(roots[0],(0,0,15)),**chest_records(roots[1],(0,0,16))}
        self.assertEqual(len(pair_chest_records(records)),2)
        a=records[(0,0,15)]['entity'];b=records[(0,0,16)]['entity']
        self.assertEqual((a['pairz'][1],b['pairz'][1]),(1,-1));self.assertEqual((a['pairx'][1],b['pairx'][1]),(0,0))

    def test_unlike_wrong_axis_or_ambiguous_chests_are_not_joined(self):
        for palette,indices in [([block('minecraft:chest'),block('minecraft:trapped_chest')],[0,1]),([block('minecraft:chest',{'facing_direction':(3,4)})],[0,0]),([block('minecraft:chest')],[0,0,0])]:
            output,_=populate_structure_containers(encoded(palette,indices))
            positions=decoded(output)['structure'][1]['palette'][1]['default'][1]['block_position_data'][1]
            self.assertTrue(all('pairx' not in p[1]['block_entity_data'][1] for p in positions.values()))

    def test_pairing_preserves_authored_items_and_nondefault_loot(self):
        positions={'0':(10,{'block_entity_data':(10,{'id':(8,'Chest'),'x':(3,0),'z':(3,0),'LootTable':(8,'loot_tables/chests/other.json')})}),
                   '1':(10,{'block_entity_data':(10,{'id':(8,'Chest'),'x':(3,1),'z':(3,0),'Items':(9,(10,[{'Name':(8,'minecraft:diamond'),'Count':(1,2)}]))})})}
        output,_=populate_structure_containers(encoded([block('minecraft:chest')],[0,0],positions))
        result=decoded(output)['structure'][1]['palette'][1]['default'][1]['block_position_data'][1]
        for key in ('0','1'):
            before=positions[key][1]['block_entity_data'][1];after=result[key][1]['block_entity_data'][1]
            for field in ('Items','LootTable'):
                if field in before:self.assertEqual(after[field],before[field])
            self.assertIn('pairx',after)

    def test_other_blocks_are_unchanged(self):
        source=encoded([block('minecraft:furnace')],[0])
        self.assertEqual(populate_structure_containers(source),(source,0))

if __name__=='__main__':unittest.main()
