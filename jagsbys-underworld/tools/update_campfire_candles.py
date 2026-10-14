"""Give converted campfire candle clusters an unambiguous full-block base."""
import copy
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
def candle_base(state):
 name=state['name'][1]
 if name.endswith('_slab') and not name.endswith('_double_slab'):
  result=copy.deepcopy(state);result['name']=(8,name.removesuffix('_slab')+'_double_slab');return result
 if name=='minecraft:air':
  return {'name':(8,'minecraft:polished_blackstone_bricks'),'states':(10,{}),'version':state['version']}
 return state

def update():
 changed=0
 for folder in ('arenas','arenas_natural'):
  for path in sorted((ROOT/'behavior_pack/structures/jagsby_nether'/folder).rglob('*.mcstructure')):
   r=NBT(path.read_bytes());r.read('B');name=r.string();root=r.payload(10);st=root['structure'][1];palette=st['palette'][1]['default'][1]['block_palette'][1][1];layer=st['block_indices'][1][1][0][1];sx,sy,sz=root['size'][1][1];edits=0
   for i,pi in enumerate(layer):
    if pi<0 or palette[pi]['name'][1]!='minecraft:red_candle' or palette[pi]['states'][1].get('candles',(3,0))[1]<2:continue
    _,rem=divmod(i,sy*sz);y,_=divmod(rem,sz)
    if y==0:continue
    below=i-sz;bi=layer[below]
    state=palette[bi] if bi>=0 else {'name':(8,'minecraft:air'),'states':(10,{}),'version':palette[pi]['version']}
    support=candle_base(state)
    if support==state:continue
    if support not in palette:palette.append(support)
    layer[below]=palette.index(support);edits+=1
   if edits:
    w=NBT();w.write('B',10);w.put_string(name);w.put(10,root);path.write_bytes(w.stream.getvalue());changed+=edits
 print(f'Campfire candle clusters: {changed} support slabs/gaps made full blocks')
if __name__=='__main__':update()
