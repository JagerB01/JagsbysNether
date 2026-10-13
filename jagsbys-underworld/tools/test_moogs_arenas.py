import hashlib
import json
import unittest
from pathlib import Path
from convert_moogs_arenas import ROOT,SOURCE,SCHEMA,ARENAS,assemble,java
from structure_crops import NBT

class MoogsArenas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.metadata=json.loads((ROOT/'MOOGS_ARENAS_SOURCE.json').read_text())
        cls.schema=json.loads(SCHEMA.read_text())['blocks']

    def test_original_source_files_match_recorded_hashes(self):
        for name,digest in self.metadata['source_files_sha256'].items():
            self.assertEqual(hashlib.sha256((SOURCE/name).read_bytes()).hexdigest(),digest,name)

    def test_complete_graph_has_expected_piece_counts_and_adjacent_joins(self):
        for arena,count in [('small_arena',4),('large_arena',6),('dragon_arena',20)]:
            pieces,joins,omitted=assemble(arena)
            self.assertEqual(len(pieces),count)
            self.assertEqual(len(joins),count-1)
            for join in joins:
                self.assertEqual([c-p for c,p in zip(join['child'],join['parent'])],join['direction'])
            self.assertTrue(all(pool.startswith('mns:mega_arenas/mobs/') for pool in omitted))

    def test_native_sections_fit_limits_have_valid_states_and_cover_layout_without_overlap(self):
        for arena in ARENAS:
            data=self.metadata['converted_templates'][arena];volume=0;rectangles=[]
            self.assertFalse(data['spawn_enabled'])
            for section in data['sections']:
                path=ROOT/'behavior_pack/structures'/Path(section['id'].replace(':','/')).with_suffix('.mcstructure')
                r=NBT(path.read_bytes());self.assertEqual(r.read('B'),10);r.string();root=r.payload(10);self.assertFalse(r.stream.read())
                size=root['size'][1][1];self.assertEqual(size,section['size']);self.assertLessEqual(size[0],64);self.assertLessEqual(size[2],64);self.assertLessEqual(size[1],256)
                n=size[0]*size[1]*size[2];volume+=n
                s=root['structure'][1];palette=s['palette'][1]['default'][1]['block_palette'][1][1]
                for b in palette:
                    name=b['name'][1];self.assertIn(name,self.schema)
                    self.assertNotIn(name,['minecraft:jigsaw','minecraft:nether_wart'])
                    for key,(tag,val) in b['states'][1].items():
                        self.assertIn(key,self.schema[name]);self.assertIn(val,self.schema[name][key]['values'])
                for _,layer in s['block_indices'][1][1]:
                    self.assertEqual(len(layer),n);self.assertTrue(all(-1<=i<len(palette) for i in layer))
                for index,entry in s['palette'][1]['default'][1]['block_position_data'][1].items():
                    i=int(index);self.assertTrue(0<=i<n)
                    e=entry[1]['block_entity_data'][1];x,rem=divmod(i,size[1]*size[2]);y,z=divmod(rem,size[2])
                    self.assertEqual([e[k][1] for k in ['x','y','z']],[x,y,z])
                    if e['id'][1] in ['Chest','Barrel']:self.assertEqual(e['LootTable'][1],'loot_tables/chests/underworld_structure.json')
                x,_,z=section['offset'];rectangles.append((x,z,x+size[0],z+size[2]))
            self.assertEqual(volume,data['size'][0]*data['size'][1]*data['size'][2])
            for i,a in enumerate(rectangles):
                for b in rectangles[i+1:]:self.assertFalse(a[0]<b[2] and b[0]<a[2] and a[1]<b[3] and b[1]<a[3])

    def test_import_has_no_natural_generation_rules(self):
        for folder in ['features','feature_rules','spawn_rules']:
            for path in (ROOT/'behavior_pack'/folder).rglob('*.json'):
                self.assertNotIn('arenas/',path.read_text(),str(path))

if __name__=='__main__':unittest.main()
