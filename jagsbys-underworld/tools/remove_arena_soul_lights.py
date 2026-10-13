"""Remove imported spawn-suppressing soul lights; preserve reference source NBT."""
from pathlib import Path
from collections import Counter
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
LIGHTS={'minecraft:soul_lantern','minecraft:soul_torch','minecraft:soul_campfire'}
def strip(path):
 r=NBT(path.read_bytes());r.read('B');r.string();root=r.payload(10);st=root['structure'][1];default=st['palette'][1]['default'][1];palette=default['block_palette'][1][1];removed={i for i,b in enumerate(palette) if b['name'][1] in LIGHTS};counts=Counter()
 if not removed:return counts
 layer=st['block_indices'][1][1][0][1]
 for i in layer:
  if i in removed:counts[palette[i]['name'][1]]+=1
 for i in removed:palette[i]={**palette[i],'name':(8,'minecraft:air'),'states':(10,{})}
 be=default['block_position_data'][1]
 for key in list(be):
  if layer[int(key)] in removed:del be[key]
 w=NBT();w.write('B',10);w.put_string('');w.put(10,root);path.write_bytes(w.stream.getvalue());return counts
if __name__=='__main__':
 for group in ('arenas','arenas_natural'):
  counts=Counter()
  for p in (ROOT/'behavior_pack/structures/jagsby_nether'/group).rglob('*.mcstructure'):counts.update(strip(p))
  print(group,dict(counts))
