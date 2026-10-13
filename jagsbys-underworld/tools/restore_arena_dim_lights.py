"""Restore imported soul-light locations as supported redstone torches.
Reference the preserved pre-removal release; source Java references stay intact.
"""
import subprocess,json,collections
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parent
BASE='4b0d849';LIGHTS={'minecraft:soul_lantern','minecraft:soul_torch','minecraft:soul_campfire'}
SOLID={'minecraft:blackstone','minecraft:polished_blackstone','minecraft:polished_blackstone_bricks','minecraft:cracked_polished_blackstone_bricks','minecraft:chiseled_polished_blackstone','minecraft:nether_brick','minecraft:red_nether_brick','minecraft:netherrack','minecraft:basalt','minecraft:smooth_basalt','minecraft:deepslate','minecraft:stone','minecraft:chiseled_deepslate','minecraft:infested_deepslate','minecraft:cobblestone','minecraft:bone_block','minecraft:soul_sand','minecraft:soul_soil','minecraft:gravel','minecraft:magma','minecraft:nether_wart_block','minecraft:warped_wart_block'}
def read(data):
 r=NBT(data);r.read('B');r.string();return r.payload(10)
def catalog(file):return json.loads((ROOT/'behavior_pack/scripts'/file).read_text().split(' = ',1)[1].rstrip(';\n'))
def process(sections):
 data=[]
 for s in sections:
  path=ROOT/'behavior_pack/structures'/f"{s['id'].replace(':','/')}.mcstructure";old=read(subprocess.check_output(['git','show',f'{BASE}:{path.relative_to(REPO)}'],cwd=REPO));current=read(path.read_bytes());data.append((s,path,old,current))
 def locate(p):
  for n,(s,path,old,current) in enumerate(data):
   off=s['offset'];size=s['size'];q=[p[i]-off[i] for i in range(3)]
   if all(0<=q[i]<size[i] for i in range(3)):return n,(q[0]*size[1]+q[1])*size[2]+q[2]
 def name(p,original=True):
  found=locate(p)
  if found is None:return None
  n,i=found;d=data[n][2 if original else 3]['structure'][1];idx=d['block_indices'][1][1][0][1][i]
  return 'minecraft:air' if idx<0 else d['palette'][1]['default'][1]['block_palette'][1][1][idx]['name'][1]
 # Remove only torches introduced by a prior run; retain original redstone lights.
 for section,path,old,current in data:
  os=old['structure'][1];cs=current['structure'][1];op=os['palette'][1]['default'][1]['block_palette'][1][1];cp=cs['palette'][1]['default'][1]['block_palette'][1][1];ol=os['block_indices'][1][1][0][1];cl=cs['block_indices'][1][1][0][1];air=next(i for i,b in enumerate(cp) if b['name'][1]=='minecraft:air')
  for i,index in enumerate(cl):
   if index>=0 and cp[index]['name'][1] in {'minecraft:redstone_torch','minecraft:red_candle','minecraft:glow_lichen'} and (ol[i]<0 or op[ol[i]]['name'][1]!=cp[index]['name'][1]):cl[i]=air
 lights=[]
 for s,path,old,current in data:
  st=old['structure'][1];pal=st['palette'][1]['default'][1]['block_palette'][1][1];sx,sy,sz=s['size']
  for i,idx in enumerate(st['block_indices'][1][1][0][1]):
   if idx>=0 and pal[idx]['name'][1] in LIGHTS:
    x,rem=divmod(i,sy*sz);y,z=divmod(rem,sz);lights.append(([x+s['offset'][0],y+s['offset'][1],z+s['offset'][2]],pal[idx]['name'][1]=='minecraft:soul_lantern' and bool(pal[idx]['states'][1].get('hanging',(0,False))[1]),pal[idx]['name'][1]=='minecraft:soul_campfire'))
 count=0
 for p,hanging,campfire in lights:
  target=None;facing=None;bits=None
  if hanging:
   highest=max(s['offset'][1]+s['size'][1] for s,_,_,_ in data)
   for yy in range(p[1],highest):
    q=[p[0],yy,p[2]]
    if name(q,False) not in {'minecraft:air','minecraft:iron_chain','minecraft:shroomlight'}:continue
    for dx,dy,dz,bit in [(0,1,0,2),(-1,0,0,16),(1,0,0,32),(0,0,-1,4),(0,0,1,8)]:
     support=name([q[0]+dx,q[1]+dy,q[2]+dz])
     slab=False
     if dy==1 and support and support.endswith('_slab'):
      found=locate([q[0]+dx,q[1]+dy,q[2]+dz])
      if found:
       nn,ii=found;ss=data[nn][2]['structure'][1];idx=ss['block_indices'][1][1][0][1][ii];state=ss['palette'][1]['default'][1]['block_palette'][1][1][idx]['states'][1];slab=state.get('minecraft:vertical_half',(0,None))[1]=='bottom'
     if support in SOLID or slab or bool(support and support.endswith(('_bricks','_tiles','_double_slab'))):target=q;bits=bit;break
    if target:break
   if target!=p and name(p,False)=='minecraft:shroomlight':
    nn,ii=locate(p);ss=data[nn][3]['structure'][1];pp=ss['palette'][1]['default'][1]['block_palette'][1][1];ss['block_indices'][1][1][0][1][ii]=next(i for i,b in enumerate(pp) if b['name'][1]=='minecraft:air')
  if hanging and target is None:hanging=False
  # Keep the location if it has floor/wall support; otherwise lower it to a floor.
  for y in ([] if hanging else range(p[1],-1,-1)):
   q=[p[0],y,p[2]]
   if name(q,False)!='minecraft:air':continue
   for dx,dy,dz,direction in [(0,-1,0,'top'),(-1,0,0,'west'),(1,0,0,'east'),(0,0,-1,'north'),(0,0,1,'south')]:
    if campfire and direction!='top':continue
    support=name([q[0]+dx,q[1]+dy,q[2]+dz])
    full=support in SOLID or bool(support and support.endswith(('_bricks','_tiles','_double_slab','_planks'))) or support in {'minecraft:cobbled_deepslate','minecraft:polished_deepslate','minecraft:tuff','minecraft:polished_tuff'}
    slab_top=False
    if direction=='top' and support and support.endswith('_slab'):
     found=locate([q[0]+dx,q[1]+dy,q[2]+dz])
     if found:
      nn,ii=found;ss=data[nn][2]['structure'][1];idx=ss['block_indices'][1][1][0][1][ii];state=ss['palette'][1]['default'][1]['block_palette'][1][1][idx]['states'][1];slab_top=state.get('minecraft:vertical_half',(0,None))[1]=='top'
    top=direction=='top' and (bool(support and support.endswith(('_wall','_fence'))) or (support is None and y==min(s['offset'][1] for s,_,_,_ in data)))
    if full or top or slab_top:target=q;facing=direction;break
   if target:break
  if target is None:continue
  n,i=locate(target);st=data[n][3]['structure'][1];default=st['palette'][1]['default'][1];pal=default['block_palette'][1][1]
  candle=not hanging and facing=='top'
  kind='minecraft:glow_lichen' if hanging else 'minecraft:red_candle' if candle else 'minecraft:redstone_torch'
  states={'multi_face_direction_bits':(3,bits)} if hanging else {'candles':(3,2 if campfire else 0),'lit':(1,1)} if candle else {'torch_facing_direction':(8,facing)}
  state={'name':(8,kind),'states':(10,states),'version':pal[0]['version']}
  try:idx=pal.index(state)
  except ValueError:idx=len(pal);pal.append(state)
  st['block_indices'][1][1][0][1][i]=idx;default['block_position_data'][1].pop(str(i),None);count+=1
 for s,path,old,current in data:
  w=NBT();w.write('B',10);w.put_string('');w.put(10,current);path.write_bytes(w.stream.getvalue())
 return len(lights),count
if __name__=='__main__':
 for file in ['arena_catalog.js']:
  for key,a in catalog(file).items():print(file,key,process(a['sections']))
 for m in catalog('modular_fortress_catalog.js'):print('module',m['index'],process(m['sections']))

if __name__=='__main__':
 from generate_natural_landmarks import generate
 generate()
