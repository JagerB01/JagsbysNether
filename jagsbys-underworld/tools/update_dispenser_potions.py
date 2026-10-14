"""Bake hostile splash-potion mixes into imported dispenser inventory slots."""
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
# Native Bedrock potion metadata: Harming II, Poison II, Decay (Wither II).
# Reference: CloudburstMC/Nukkit, cn/nukkit/potion/Potion.java.
SPLASH_MIX=(24,27,36)
def mix_items(items,start=0):
 changed=0
 for item in items:
  if item.get('Name')==(8,'minecraft:splash_potion') and item.get('Damage',(2,0))[1]==0:
   item['Damage']=(2,SPLASH_MIX[(start+changed)%len(SPLASH_MIX)]);changed+=1
 return changed

def update():
 slots=0;files=0
 for folder in ('arenas','arenas_natural'):
  for path in sorted((ROOT/'behavior_pack/structures/jagsby_nether'/folder).rglob('*.mcstructure')):
   r=NBT(path.read_bytes());r.read('B');name=r.string();root=r.payload(10);changed=0
   for entry in root['structure'][1]['palette'][1]['default'][1]['block_position_data'][1].values():
    e=entry[1].get('block_entity_data',(10,{}))[1]
    if e.get('id')==(8,'Dispenser'):changed+=mix_items(e.get('Items',(9,(10,[])))[1][1])
   if changed:
    w=NBT();w.write('B',10);w.put_string(name);w.put(10,root);path.write_bytes(w.stream.getvalue());files+=1;slots+=changed
 print(f'Hostile dispenser splash mix: {slots} water-potion slots replaced in {files} templates')
if __name__=='__main__':update()
