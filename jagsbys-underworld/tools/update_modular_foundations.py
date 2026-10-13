"""Record the underside of each structural column, rather than the template box."""
import json
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
NONSTRUCTURAL={'minecraft:air','minecraft:water','minecraft:lava','minecraft:flowing_lava','minecraft:flowing_water','minecraft:iron_chain','minecraft:glow_lichen','minecraft:red_candle','minecraft:redstone_torch','minecraft:unlit_redstone_torch','minecraft:soul_torch','minecraft:soul_lantern','minecraft:lantern','minecraft:torch','minecraft:mob_spawner','minecraft:chest','minecraft:barrel','minecraft:shroomlight'}
def update():
 path=ROOT/'behavior_pack/scripts/modular_fortress_catalog.js';modules=json.loads(path.read_text().split(' = ',1)[1].rstrip(';\n'))
 for m in modules:
  for section in m['sections']:
   p=ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure";r=NBT(p.read_bytes());r.read('B');r.string();root=r.payload(10);st=root['structure'][1];names=[s['name'][1] for s in st['palette'][1]['default'][1]['block_palette'][1][1]];layer=st['block_indices'][1][1][0][1];sx,sy,sz=section['size'];columns=[]
   for x in range(sx):
    for z in range(sz):
     for y in range(sy):
      idx=layer[(x*sy+y)*sz+z]
      if idx>=0 and names[idx] not in NONSTRUCTURAL and not names[idx].endswith(('_roots','_vines','_fungus')):
       columns.append([x,z,y]);break
   section['foundationColumns']=columns;section['foundation']['moduleIndex']=m['index']
 path.write_text('export const FORTRESS_MODULES = '+json.dumps(modules,separators=(',',':'))+';\n')
if __name__=='__main__':update()
