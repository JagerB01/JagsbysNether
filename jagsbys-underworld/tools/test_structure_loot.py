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

    def test_other_blocks_are_unchanged(self):
        source=encoded([block('minecraft:furnace')],[0])
        self.assertEqual(populate_structure_containers(source),(source,0))

if __name__=='__main__':unittest.main()
