"""Validate actual relocation geometry, infill, idempotence and enchanted selection."""
import json,unittest
from collections import Counter
from trial_spawn_geometry import ROOT,arenas,natural,sites,block,positions
from update_trial_encounters import read
from relocate_trial_spawners import relocate
from structure_crops import NBT
class TrialPositions(unittest.TestCase):
    def test_relocated_spawners_have_floor_headroom_and_clear_paths_in_both_layouts(self):
        config=json.loads((ROOT/'TRIAL_ENCOUNTERS.json').read_text())
        self.assertEqual(Counter(m['layout'] for m in config['relocations']),{'small_arena':8,'large_arena':18,'dragon_arena':5})
        for m in config['relocations']:
            for layouts in [arenas,natural]:
                sections=layouts[m['layout']]['sections']
                self.assertEqual(block(sections,*m['from'])[0],m['fill'])
                self.assertEqual(block(sections,*m['to'])[0],'minecraft:trial_spawner')
                self.assertGreaterEqual(len(positions(sections,m['to'])),10,(m,layouts is natural))
    def test_spawner_totals_are_preserved_and_new_positions_are_catalogued(self):
        config=json.loads((ROOT/'TRIAL_ENCOUNTERS.json').read_text())
        for name,count in [('small_arena',8),('large_arena',26),('dragon_arena',13)]:
            self.assertEqual(len(sites[name]),count)
            dest={tuple(s['offset']) for s in sites[name]}
            self.assertEqual(len(dest),count)
            for m in config['relocations']:
                if m['layout']==name:
                    self.assertIn(tuple(m['to']),dest);self.assertNotIn(tuple(m['from']),dest)
    def test_relocation_rebuild_is_idempotent_without_mutating_source_files(self):
        config=json.loads((ROOT/'TRIAL_ENCOUNTERS.json').read_text())
        def check(path,data,name):
            w=NBT();w.write('B',10);w.put_string(name);w.put(10,data)
            self.assertEqual(w.stream.getvalue(),path.read_bytes())
        for name in ['small_arena','large_arena','dragon_arena']:
            relocate(arenas[name]['sections'],[m for m in config['relocations'] if m['layout']==name],ROOT,read,check)
    def test_trial_casters_roll_thirty_three_percent_and_ordinary_necromancer_keeps_ten_percent(self):
        conf=json.loads((ROOT/'TRIAL_ENCOUNTERS.json').read_text());weights={p['entity']:p['weight'] for p in conf['spawn_pool']}
        self.assertEqual(weights,{'dungeons:trial_tower_wraith':10,'dungeons:trial_necromancer':10,'minecraft:piglin_brute':20})
        for name in ['tower_wraith','necromancer']:
            trial=json.loads((ROOT/f'behavior_pack/entities/infernal_lords/trial_{name}.json').read_text())['minecraft:entity']
            rolls=trial['events']['minecraft:entity_spawned']['randomize']
            self.assertEqual([r['weight'] for r in rolls],[33,67])
            self.assertEqual(trial['component_groups']['jagsby_nether:trial_enchanted']['minecraft:transformation']['into'],f'dungeons:enchanted_{name}<minecraft:entity_spawned>')
        mob=json.loads((ROOT/'behavior_pack/entities/new/necromancer/necromancer.json').read_text())['minecraft:entity']
        rolls=mob['events']['minecraft:entity_spawned']['randomize'];self.assertEqual(sum(r['weight'] for r in rolls),10)
        self.assertEqual(next(r['weight'] for r in rolls if r.get('trigger')=='dungeons:become_enchanted'),1)
        for path in ['enchanted_tower_wraith.json','enchanted_necromancer.json']:
            entity=json.loads((ROOT/'behavior_pack/entities/enchanted/new'/path).read_text())['minecraft:entity']
            self.assertIn('enchanted',entity['components']['minecraft:type_family']['family'])
if __name__=='__main__':unittest.main()
