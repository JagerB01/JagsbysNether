import hashlib
import json
import unittest
from pathlib import Path
from convert_moogs_arenas import ROOT,SOURCE,SCHEMA,ARENAS,assemble,java,block_state
from structure_crops import NBT

class MoogsArenas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.metadata=json.loads((ROOT/'MOOGS_ARENAS_SOURCE.json').read_text())
        cls.schema=json.loads(SCHEMA.read_text())['blocks']

    def test_imported_templates_contain_no_spawn_suppressing_soul_lights(self):
        lights={'minecraft:soul_lantern','minecraft:soul_torch','minecraft:soul_campfire'}
        for group in ('arenas','arenas_natural'):
            for path in (ROOT/'behavior_pack/structures/jagsby_nether'/group).rglob('*.mcstructure'):
                r=NBT(path.read_bytes());r.read('B');r.string();root=r.payload(10)
                palette=root['structure'][1]['palette'][1]['default'][1]['block_palette'][1][1]
                self.assertFalse(lights.intersection(b['name'][1] for b in palette),str(path))

    def test_hanging_soul_lights_become_lichen_and_floor_lights_become_red_candles(self):
        self.assertEqual(block_state('minecraft:soul_lantern',{'hanging':'true'},self.schema)['name'][1],'minecraft:glow_lichen')
        self.assertEqual(block_state('minecraft:soul_lantern',{'hanging':'false'},self.schema)['name'][1],'minecraft:red_candle')
        campfire=block_state('minecraft:soul_campfire',{},self.schema)
        self.assertEqual(campfire['name'][1],'minecraft:red_candle')
        self.assertEqual(campfire['states'][1]['candles'][1],2)
        self.assertTrue(campfire['states'][1]['lit'][1])
        wall=block_state('minecraft:soul_wall_torch',{'facing':'east'},self.schema)
        self.assertEqual(wall['name'][1],'minecraft:redstone_torch')
        self.assertEqual(wall['states'][1]['torch_facing_direction'][1],'west')

    def test_original_source_files_match_recorded_hashes(self):
        for name,digest in self.metadata['source_files_sha256'].items():
            self.assertEqual(hashlib.sha256((SOURCE/name).read_bytes()).hexdigest(),digest,name)

    def test_complete_graph_has_expected_piece_counts_and_adjacent_joins(self):
        for arena,count in [('small_arena',4),('large_arena',6),('dragon_arena',20),('grave_yard',1),('large_blackstone_pillars',1),('large_blackstone_walls',1)]:
            pieces,joins,omitted=assemble(arena)
            self.assertEqual(len(pieces),count)
            self.assertEqual(len(joins),count-1)
            for join in joins:
                self.assertEqual([c-p for c,p in zip(join['child'],join['parent'])],join['direction'])
            self.assertTrue(all(pool.startswith('mns:mega_arenas/mobs/') for pool in omitted))

    def test_native_sections_fit_limits_have_valid_states_and_cover_layout_without_overlap(self):
        for arena in ARENAS:
            data=self.metadata['converted_templates'][arena];volume=0;rectangles=[]
            self.assertTrue(data['spawn_enabled'])
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

    def test_trial_conversion_keeps_fortress_module_and_graveyard_spawners_ordinary(self):
        def counts(sections):
            result={'minecraft:mob_spawner':0,'minecraft:trial_spawner':0}
            for section in sections:
                r=NBT((ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure").read_bytes());r.read('B');r.string();st=r.payload(10)['structure'][1]
                names=[b['name'][1] for b in st['palette'][1]['default'][1]['block_palette'][1][1]]
                for i in st['block_indices'][1][1][0][1]:
                    if i>=0 and names[i] in result:result[names[i]]+=1
            return result
        arenas=json.loads((ROOT/'behavior_pack/scripts/arena_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n'))
        for name,trial in [('small_arena',8),('large_arena',26),('dragon_arena',13)]:
            self.assertEqual(counts(arenas[name]['sections']),{'minecraft:mob_spawner':0,'minecraft:trial_spawner':trial})
        self.assertEqual(counts(arenas['mega_fortress']['sections']),{'minecraft:mob_spawner':3,'minecraft:trial_spawner':9})
        self.assertEqual(counts(arenas['grave_yard']['sections']),{'minecraft:mob_spawner':1,'minecraft:trial_spawner':0})
        modules=json.loads((ROOT/'behavior_pack/scripts/modular_fortress_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n'))
        self.assertEqual(counts(modules[0]['sections']),{'minecraft:mob_spawner':0,'minecraft:trial_spawner':5})
        self.assertEqual(counts([s for m in modules[1:5] for s in m['sections']]),{'minecraft:mob_spawner':0,'minecraft:trial_spawner':4})
        self.assertEqual(counts([s for m in modules[5:] for s in m['sections']]),{'minecraft:mob_spawner':3,'minecraft:trial_spawner':0})

    def test_modular_void_masks_and_foundation_feet_match_the_actual_template(self):
        from update_modular_foundations import structural
        modules=json.loads((ROOT/'behavior_pack/scripts/modular_fortress_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n'))
        for module in modules:
            for section in module['sections']:
                r=NBT((ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure").read_bytes());r.read('B');r.string();st=r.payload(10)['structure'][1]
                names=[b['name'][1] for b in st['palette'][1]['default'][1]['block_palette'][1][1]];layer=st['block_indices'][1][1][0][1];sx,sy,sz=section['size']
                self.assertFalse(any(i>=0 and names[i]=='minecraft:red_stained_glass' for i in layer))
                for x,z,y in section['foundationColumns']:
                    i=layer[(x*sy+y)*sz+z];self.assertGreaterEqual(i,0);self.assertTrue(structural(names[i]))
                    self.assertFalse(any(layer[(x*sy+below)*sz+z]>=0 and structural(names[layer[(x*sy+below)*sz+z]]) for below in range(y)))
                if module['index']<5:continue
                covered=set()
                for volume in section['buildVolumes']:
                    ox,oy,oz=volume['offset'];vx,vy,vz=volume['size']
                    for x in range(ox,ox+vx):
                        for y in range(oy,oy+vy):
                            for z in range(oz,oz+vz):
                                i=(x*sy+y)*sz+z;self.assertNotIn(i,covered);covered.add(i)
                for i,pi in enumerate(layer):
                    if pi>=0:self.assertIn(i,covered,'Native placement must preserve blocks outside the surveyed envelope')

    def test_dispenser_water_bottles_are_hostile_native_splash_potions(self):
        from update_dispenser_potions import SPLASH_MIX,mix_items
        water={'Name':(8,'minecraft:splash_potion'),'Count':(1,3),'Damage':(2,0),'Slot':(1,4)}
        items=[dict(water) for _ in range(3)]+[{'Name':(8,'minecraft:arrow'),'Count':(1,2),'Damage':(2,0)}]
        self.assertEqual(mix_items(items),3);self.assertEqual([i['Damage'][1] for i in items[:3]],list(SPLASH_MIX));self.assertEqual(mix_items(items),0)
        self.assertEqual(items[0]['Count'],(1,3));self.assertEqual(items[0]['Slot'],(1,4));self.assertEqual(items[-1]['Name'],(8,'minecraft:arrow'))
        variants=set();slots=0
        for folder in ('arenas','arenas_natural'):
            for path in (ROOT/'behavior_pack/structures/jagsby_nether'/folder).rglob('*.mcstructure'):
                r=NBT(path.read_bytes());r.read('B');r.string();st=r.payload(10)['structure'][1]
                for entry in st['palette'][1]['default'][1]['block_position_data'][1].values():
                    e=entry[1]['block_entity_data'][1]
                    if e['id'][1]!='Dispenser':continue
                    for item in e.get('Items',(9,(10,[])))[1][1]:
                        if item.get('Name')!=(8,'minecraft:splash_potion'):continue
                        self.assertIn(item['Damage'][1],SPLASH_MIX);variants.add(item['Damage'][1]);slots+=1
        self.assertGreater(slots,0);self.assertEqual(variants,set(SPLASH_MIX))

    def test_campfire_candle_clusters_have_lit_three_candle_states_and_full_bases(self):
        found=0
        for folder in ('arenas','arenas_natural'):
            for path in (ROOT/'behavior_pack/structures/jagsby_nether'/folder).rglob('*.mcstructure'):
                r=NBT(path.read_bytes());r.read('B');r.string();root=r.payload(10);st=root['structure'][1];palette=st['palette'][1]['default'][1]['block_palette'][1][1];layer=st['block_indices'][1][1][0][1];sx,sy,sz=root['size'][1][1]
                for i,pi in enumerate(layer):
                    if pi<0 or palette[pi]['name'][1]!='minecraft:red_candle':continue
                    state=palette[pi]['states'][1]
                    if state['candles'][1]<2:continue
                    found+=1;self.assertEqual(state['candles'][1],2);self.assertTrue(state['lit'][1]);y=(i//sz)%sy;self.assertGreater(y,0)
                    bi=layer[i-sz];self.assertGreaterEqual(bi,0);name=palette[bi]['name'][1]
                    self.assertNotIn(name,('minecraft:air','minecraft:water','minecraft:lava'))
                    self.assertFalse(name.endswith('_slab') and not name.endswith('_double_slab'),str(path))
        self.assertGreater(found,0)

    def test_native_trial_presets_have_the_configured_mobs_and_valid_local_positions(self):
        encounters=json.loads((ROOT/'behavior_pack/scripts/trial_encounter_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n'))
        config=json.loads((ROOT/'TRIAL_ENCOUNTERS.json').read_text())
        for profile,identifier in encounters['presets'].items():
            r=NBT((ROOT/'behavior_pack/structures'/f"{identifier.replace(':','/')}.mcstructure").read_bytes());r.read('B');r.string();root=r.payload(10)
            self.assertEqual(root['size'][1][1],[1,1,1]);st=root['structure'][1];default=st['palette'][1]['default'][1]
            self.assertEqual(default['block_palette'][1][1][0]['name'][1],'minecraft:trial_spawner')
            entity=default['block_position_data'][1]['0'][1]['block_entity_data'][1]
            self.assertEqual(entity['id'][1],'TrialSpawner');self.assertEqual([entity[k][1] for k in ['x','y','z']],[0,0,0])
            group,role=profile.split('/');mob=config['groups'][group][role]
            if mob:
                self.assertEqual(entity['spawn_data'][1]['TypeId'][1],mob)
                self.assertEqual(entity['normal_config'][1]['total_mobs'][1],config['defaults']['total_mobs'])
                self.assertEqual(entity['required_player_range'][1],config['defaults']['required_player_range'])
            else:self.assertNotIn('spawn_data',entity)

    def test_arena_crowding_is_baked_into_actual_native_trial_spawner_data(self):
        import math
        encounters=json.loads((ROOT/'behavior_pack/scripts/trial_encounter_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n'))
        config=json.loads((ROOT/'TRIAL_ENCOUNTERS.json').read_text())
        arenas=json.loads((ROOT/'behavior_pack/scripts/arena_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n'))
        for name in ['small_arena','large_arena','dragon_arena']:
            actual={}
            for section in arenas[name]['sections']:
                r=NBT((ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure").read_bytes());r.read('B');r.string();st=r.payload(10)['structure'][1]
                default=st['palette'][1]['default'][1];sx,sy,sz=section['size'];ox,oy,oz=section['offset']
                for index,entry in default['block_position_data'][1].items():
                    e=entry[1]['block_entity_data'][1]
                    if e['id'][1]!='TrialSpawner':continue
                    i=int(index);x,rem=divmod(i,sy*sz);y,z=divmod(rem,sz)
                    actual[x+ox,y+oy,z+oz]=e['spawn_data'][1]['TypeId'][1]
            prior=[]
            for slot in sorted(encounters['sites'][name],key=lambda s:s['offset']):
                nearby=sum(math.dist(slot['offset'],s['offset'])<=16 for s in prior if s['profile'].endswith('/brute'))
                mob='minecraft:stray' if nearby>=2 else 'minecraft:piglin_brute'
                self.assertEqual(actual[tuple(slot['offset'])],mob)
                self.assertEqual(config['groups'][name][slot['profile'].split('/')[1]],mob)
                prior.append(slot)
            self.assertTrue(all(mob in ['minecraft:stray','minecraft:piglin_brute'] for mob in actual.values()))
        self.assertTrue(any(s['profile'].endswith('/stray') for s in encounters['sites']['small_arena']))

    def test_import_has_no_natural_generation_rules(self):
        for folder in ['features','feature_rules','spawn_rules']:
            for path in (ROOT/'behavior_pack'/folder).rglob('*.json'):
                self.assertNotIn('arenas/',path.read_text(),str(path))

    def test_fortress_layout_is_connected_reproducible_and_has_rotated_pieces(self):
        pieces,joins,omitted=assemble('mega_fortress')
        recorded=self.metadata['converted_templates']['mega_fortress']
        self.assertEqual(len(pieces),len(recorded['source_pieces']))
        self.assertGreater(len(pieces),50)
        self.assertEqual(len(joins),len(pieces)-1)
        self.assertEqual(joins,recorded['joins'])
        self.assertTrue(any(rotation!=0 for _,_,rotation,_ in pieces))
        for join in joins:
            self.assertEqual([c-p for c,p in zip(join['child'],join['parent'])],join['direction'])
        # Piece bounding boxes must not overlap after applying rotations.
        from convert_moogs_arenas import rotation,add
        boxes=[]
        for loc,origin,r,data in pieces:
            size=data['size'][1][1]
            corners=[add(origin,rotation((x,y,z),r)) for x in [0,size[0]-1] for y in [0,size[1]-1] for z in [0,size[2]-1]]
            boxes.append(tuple(min(c[i] for c in corners) for i in range(3))+tuple(max(c[i] for c in corners)+1 for i in range(3)))
        for i,a in enumerate(boxes):
            for b in boxes[i+1:]:self.assertFalse(all(a[k]<b[k+3] and b[k]<a[k+3] for k in range(3)))

    def test_rotation_preserves_facing_axis_and_wall_connections(self):
        from convert_moogs_arenas import rotate_properties
        result=rotate_properties({'facing':'east','axis':'x','east':'low','north':'tall','west':'none','south':'none'},1)
        self.assertEqual(result['facing'],'south')
        self.assertEqual(result['axis'],'z')
        self.assertEqual(result['south'],'low')
        self.assertEqual(result['east'],'tall')

if __name__=='__main__':unittest.main()
