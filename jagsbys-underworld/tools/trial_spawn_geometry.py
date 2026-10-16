"""Conservative offline floor/headroom/ray audit; not a native spawning simulation."""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
from update_trial_encounters import read
base=ROOT/'behavior_pack'
def cat(n):return json.loads((base/'scripts'/n).read_text().split(' = ',1)[1].rstrip(';\n'))
arenas=cat('arena_catalog.js');natural=cat('natural_arena_catalog.js');modules=cat('modular_fortress_catalog.js');sites=cat('trial_encounter_catalog.js')['sites']
cache={}
def block(sections,x,y,z):
 for s in sections:
  ox,oy,oz=s['offset'];sx,sy,sz=s['size']
  if ox<=x<ox+sx and oy<=y<oy+sy and oz<=z<oz+sz:
   k=s['id']
   if k not in cache:
    _,_,r=read(base/'structures'/(k.replace(':','/')+'.mcstructure'));st=r['structure'][1];cache[k]=(st['block_indices'][1][1][0][1],st['palette'][1]['default'][1]['block_palette'][1][1])
   indices,pal=cache[k];i=indices[(x-ox)*sy*sz+(y-oy)*sz+z-oz]
   return ('unplaced',{}) if i<0 else (pal[i]['name'][1],pal[i].get('states',(10,{}))[1])
 return ('unplaced',{})
passable={'minecraft:air','minecraft:cave_air','minecraft:torch','minecraft:redstone_torch','minecraft:unlit_redstone_torch','minecraft:glow_lichen','minecraft:vine','minecraft:trip_wire','minecraft:light_block'}
full={'minecraft:blackstone','minecraft:polished_blackstone','minecraft:polished_blackstone_bricks','minecraft:cracked_polished_blackstone_bricks','minecraft:chiseled_polished_blackstone','minecraft:nether_brick','minecraft:red_nether_brick','minecraft:chiseled_nether_bricks','minecraft:cracked_nether_bricks','minecraft:basalt','minecraft:polished_basalt','minecraft:smooth_basalt','minecraft:netherrack','minecraft:deepslate','minecraft:obsidian','minecraft:crying_obsidian','minecraft:gold_block','minecraft:stone','minecraft:bedrock','minecraft:bone_block'}
full.update(['minecraft:trial_spawner','minecraft:mob_spawner'])
full.update('minecraft:'+n for n in ['deepslate_bricks','cracked_deepslate_bricks','chiseled_deepslate','polished_deepslate','deepslate_tiles','cracked_deepslate_tiles','cobbled_deepslate','nether_wart_block','warped_wart_block','crimson_hyphae','warped_hyphae','crimson_stem','warped_stem','raw_gold_block','soul_soil','shroomlight','gilded_blackstone'])
passable.update(['minecraft:weeping_vines','minecraft:twisting_vines','minecraft:wall_banner','minecraft:standing_banner','minecraft:redstone_wire'])
def safe_floor(name,states):
 return name in full or 'double_slab' in name or ('slab' in name and (states.get('minecraft:vertical_half',(8,''))[1]=='top' or states.get('top_slot_bit',(1,0))[1]==1))

def positions(sections,p):
 x,y,z=p;out=[]
 for dx in range(-4,5):
  for dz in range(-4,5):
   for dy in [-1,0,1]:
    xx,yy,zz=x+dx,y+dy,z+dz;n,st=block(sections,xx,yy-1,zz)
    if not safe_floor(n,st):continue
    if not all(block(sections,xx,h,zz)[0] in passable for h in [yy,yy+1,yy+2]):continue
    # Clear ray from spawner centre to spawn body's centre, excluding spawner.
    a=[x+.5,y+.5,z+.5];b=[xx+.5,yy+.8,zz+.5];steps=math.ceil(math.dist(a,b)*8)
    clear=True
    for i in range(1,steps+1):
     q=tuple(math.floor(a[j]+(b[j]-a[j])*i/steps) for j in range(3))
     if q==tuple(p):continue
     if block(sections,*q)[0] not in passable:clear=False;break
    if clear:out.append([xx,yy,zz])
 return out
