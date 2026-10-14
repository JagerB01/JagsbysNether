"""Resolve source pier markers and preserve terrain below suspended bridge decks."""
import json
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
NONSTRUCTURAL={'minecraft:air','minecraft:water','minecraft:lava','minecraft:flowing_lava','minecraft:flowing_water','minecraft:iron_chain','minecraft:glow_lichen','minecraft:red_candle','minecraft:redstone_torch','minecraft:unlit_redstone_torch','minecraft:soul_torch','minecraft:soul_lantern','minecraft:lantern','minecraft:torch','minecraft:mob_spawner','minecraft:trial_spawner','minecraft:vault','minecraft:chest','minecraft:barrel','minecraft:shroomlight'}
MARKER='minecraft:red_stained_glass'
def structural(name):
 return name not in NONSTRUCTURAL and name!=MARKER and not name.endswith(('_roots','_vines','_fungus'))
def rectangles(spans,sx,sz):
 # Merge neighboring columns with identical vertical envelopes offline.
 active={};result=[]
 for x in range(sx):
  runs=[];z=0
  while z<sz:
   span=spans.get((x,z));end=z+1
   while end<sz and spans.get((x,end))==span:end+=1
   if span:runs.append((z,end,*span))
   z=end
  next_active={}
  for key in runs:
   if key in active:v=active.pop(key);v['size'][0]+=1
   else:
    z,end,lo,hi=key;v={'offset':[x,lo,z],'size':[1,hi-lo+1,end-z]}
   next_active[key]=v
  result.extend(active.values());active=next_active
 result.extend(active.values());return result

def update():
 path=ROOT/'behavior_pack/scripts/modular_fortress_catalog.js';modules=json.loads(path.read_text().split(' = ',1)[1].rstrip(';\n'))
 for m in modules:
  grounded=m['index']==0 or (m['size'][1]>=24 and not any('/ends/' in src or 'staircase_upper' in src or 'staircase_side' in src for src in m['source']))
  for section in m['sections']:
   p=ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure";r=NBT(p.read_bytes());r.read('B');name=r.string();root=r.payload(10);st=root['structure'][1];palette=st['palette'][1]['default'][1]['block_palette'][1][1];names=[s['name'][1] for s in palette];layers=st['block_indices'][1][1];layer=layers[0][1];sx,sy,sz=section['size'];columns=[];spans={};markers={tuple(v) for v in section.get('pierMarkers',[])}
   replacement={'name':(8,'minecraft:polished_blackstone_bricks'),'states':(10,{}),'version':palette[0]['version']}
   if replacement not in palette:palette.append(replacement);names.append('minecraft:polished_blackstone_bricks')
   replacement_id=palette.index(replacement)
   for x in range(sx):
    for z in range(sz):
     blocks=[];solids=[]
     for y in range(sy):
      i=(x*sy+y)*sz+z;idx=layer[i]
      if idx<0:continue
      block=names[idx]
      if block==MARKER:
       markers.add((x,z,y));layer[i]=replacement_id;block='minecraft:polished_blackstone_bricks'
      if block!='minecraft:air':blocks.append(y)
      if structural(block):solids.append(y)
     if solids:
      y=solids[0];local_y=section['offset'][1]-m['offset'][1]+y
      if grounded and (any(mx==x and mz==z for mx,mz,_ in markers) or local_y<=1):columns.append([x,z,y])
     if blocks:spans[x,z]=(min(blocks),max(blocks))
   if m['index']>=5:
    # Air inside each authored vertical envelope still opens the walkways.
    # Air beneath decks/outside the architecture must not excavate mountains.
    for x in range(sx):
     for z in range(sz):
      lo,hi=spans.get((x,z),(sy,-1))
      for y in range(sy):
       if y<lo or y>hi:
        i=(x*sy+y)*sz+z
        for _,values in layers:
         if values[i]>=0 and names[values[i]]=='minecraft:air':values[i]=-1
    section['buildVolumes']=rectangles(spans,sx,sz)
   section['pierMarkers']=sorted(map(list,markers));section['foundationColumns']=columns;section['foundation']['moduleIndex']=m['index']
   w=NBT();w.write('B',10);w.put_string(name);w.put(10,root);p.write_bytes(w.stream.getvalue())
 path.write_text('export const FORTRESS_MODULES = '+json.dumps(modules,separators=(',',':'))+';\n')
if __name__=='__main__':update()
