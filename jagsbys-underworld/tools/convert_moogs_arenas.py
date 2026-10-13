"""Reproducible Java 1.21 arena layout import; no world-generation rules."""
import argparse
import collections
import gzip
import hashlib
import json
import math
import struct
import zipfile
from pathlib import Path
from structure_crops import NBT
from structure_loot import populate_structure_containers

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'behavior_pack/docs/moogs_arenas/source_data'
SCHEMA = Path(__file__).with_name('moogs_block_schema.json')
ARENAS = ('small_arena', 'large_arena', 'dragon_arena', 'grave_yard', 'large_blackstone_pillars', 'large_blackstone_walls', 'mega_fortress')
DIRECTIONS = {'east': (1,0,0), 'west': (-1,0,0), 'up': (0,1,0), 'down': (0,-1,0), 'south': (0,0,1), 'north': (0,0,-1)}
FACING = {'down':0,'up':1,'north':2,'south':3,'west':4,'east':5}
DIRECTION = {'south':0,'west':1,'north':2,'east':3}
ALIASES = {'tripwire':'trip_wire','spawner':'mob_spawner','red_nether_bricks':'red_nether_brick','nether_bricks':'nether_brick',
           'weeping_vines_plant':'weeping_vines','chain':'iron_chain','stonecutter':'stonecutter_block',
           'magma_block':'magma','nether_quartz_ore':'quartz_ore','soul_wall_torch':'soul_torch',
           'redstone_wall_torch':'redstone_torch','red_wall_banner':'wall_banner',
           'slime_block':'slime','cobweb':'web','note_block':'noteblock','oak_trapdoor':'trapdoor',
           'oak_button':'wooden_button','oak_pressure_plate':'wooden_pressure_plate',
           'dark_oak_wall_sign':'darkoak_wall_sign','skeleton_wall_skull':'skeleton_skull'}

class JavaNBT(NBT):
    def read(self, fmt):
        return struct.unpack('>'+fmt, self.stream.read(struct.calcsize('>'+fmt)))[0]

def java(data):
    r=JavaNBT(gzip.decompress(data) if data[:2]==b'\x1f\x8b' else data)
    kind=r.read('B');r.string();assert kind==10
    result=r.payload(kind);assert not r.stream.read();return result

def value(compound, key, default=None):
    return compound.get(key,(0,default))[1]

def rotation(v,r):
    x,y,z=v
    for _ in range(r):x,z=-z,x
    return (x,y,z)

def add(a,b):return tuple(x+y for x,y in zip(a,b))
def sub(a,b):return tuple(x-y for x,y in zip(a,b))

def connections(data):
    result=[];palette=data['palette'][1][1]
    for block in data['blocks'][1][1]:
        e=value(block,'nbt',{})
        if value(e,'id')!='minecraft:jigsaw':continue
        front,top=value(palette[value(block,'state')]['Properties'][1],'orientation').split('_')
        result.append({'pos':tuple(block['pos'][1][1]),'front':DIRECTIONS[front],'top':DIRECTIONS[top],
                       **{key:value(e,key) for key in ('name','target','pool')}})
    return result

def source_pool(pool):
    ns,path=pool.split(':');return json.loads((SOURCE/f'data/{ns}/worldgen/template_pool/{path}.json').read_text())

def select_location(pool):
    e=source_pool(pool)['elements'][0]['element']
    # Use the uploaded mod's Java 1.21 variants, not newer-game alternatives.
    return next((v for k,v in e.get('locations',{}).items() if k.split('-')[0]=='1.21'),e['location'])

def load_piece(pool):
    loc=select_location(pool);ns,path=loc.split(':');return loc,java((SOURCE/f'data/{ns}/structure/{path}.nbt').read_bytes())

def assemble(arena):
    if arena=='mega_fortress':return assemble_fortress()
    definition=json.loads((SOURCE/f'data/mns/worldgen/structure/{arena}.json').read_text())
    queue=[(definition['start_pool'],(0,0,0),0)];pieces=[];seen=set();joints=[];omitted=collections.Counter()
    while queue:
        pool,origin,r=queue.pop(0);loc,data=load_piece(pool)
        assert loc not in seen,('Repeated structural piece',loc)
        seen.add(loc);pieces.append((loc,origin,r,data))
        for c in connections(data):
            if c['pool']=='minecraft:empty':continue
            if not c['pool'].startswith(f'mns:{arena}/'):
                omitted[c['pool']]+=1;continue  # Boss/mob processors are outside the template import.
            _,child_data=load_piece(c['pool']);front=rotation(c['front'],r);top=rotation(c['top'],r)
            anchor=add(add(origin,rotation(c['pos'],r)),front);matches=[]
            for child in connections(child_data):
                if child['name']!=c['target']:continue
                for cr in range(4):
                    if rotation(child['front'],cr)==tuple(-x for x in front) and rotation(child['top'],cr)==top:
                        matches.append((sub(anchor,rotation(child['pos'],cr)),cr,child))
            assert len(matches)==1,('Ambiguous/missing join',pool,c,matches)
            child_origin,cr,child=matches[0]
            joints.append({'from':loc,'pool':c['pool'],'parent':list(add(origin,rotation(c['pos'],r))),
                           'child':list(add(child_origin,rotation(child['pos'],cr))),'direction':list(front)})
            queue.append((c['pool'],child_origin,cr))
    return pieces,joints,dict(omitted)

def rotate_properties(props,r):
    result=dict(props)
    reverse={v:k for k,v in DIRECTIONS.items()}
    if 'facing' in props:result['facing']=reverse[rotation(DIRECTIONS[props['facing']],r)]
    if r%2 and props.get('axis') in ('x','z'):result['axis']='z' if props['axis']=='x' else 'x'
    if 'rotation' in props:result['rotation']=str((int(props['rotation'])+r*4)%16)
    for name in ['east','west','north','south']:
        if name in props:result[reverse[rotation(DIRECTIONS[name],r)]]=props[name]
    return result

def assemble_fortress():
    import random
    rng=random.Random(31011)
    root='mns:mega_fortress/start/start_pool';loc,data=load_piece(root)
    pieces=[(loc,(0,0,0),0,data)];queue=[];joints=[];omitted=collections.Counter();boxes=[]
    def bounds(origin,r,data):
        size=data['size'][1][1];points=[add(origin,rotation((x,y,z),r)) for x in [0,size[0]-1] for y in [0,size[1]-1] for z in [0,size[2]-1]]
        return tuple(min(p[i] for p in points) for i in range(3))+tuple(max(p[i] for p in points)+1 for i in range(3))
    boxes.append(bounds((0,0,0),0,data))
    def enqueue(loc,data,origin,r,depth,incoming=None):
        for c in connections(data):
            if incoming is not None and c['pos']==incoming:continue
            if c['pool']=='minecraft:empty':continue
            if '/mobs/' in c['pool']:omitted[c['pool']]+=1;continue
            if not c['pool'].startswith('mns:mega_fortress/'):omitted[c['pool']]+=1;continue
            queue.append((loc,c,origin,r,depth))
    enqueue(loc,data,(0,0,0),0,0)
    while queue and len(pieces)<96:
        parent_loc,c,parent_origin,parent_rotation,depth=queue.pop(0)
        front=rotation(c['front'],parent_rotation);top=rotation(c['top'],parent_rotation)
        parent_pos=add(parent_origin,rotation(c['pos'],parent_rotation));anchor=add(parent_pos,front)
        pool=c['pool'];force_end=depth>=5 or len(pieces)>=64;attached=False;visited=set()
        while pool!='minecraft:empty' and pool not in visited:
            visited.add(pool);definition=source_pool(pool)
            if force_end and not any(k in pool for k in ['/ends/','upper_end','lower/']):
                pool=definition['fallback'];continue
            entries=list(definition['elements']);rng.shuffle(entries)
            # Weighted shuffle supplies a deterministic representative layout.
            entries.sort(key=lambda e:rng.random()**(1/max(1,e['weight'])),reverse=True)
            for entry in entries:
                element=entry['element']
                if 'location' not in element:continue
                child_loc=next((v for k,v in element.get('locations',{}).items() if k.split('-')[0]=='1.21'),element['location']);ns,path=child_loc.split(':')
                child_data=java((SOURCE/f'data/{ns}/structure/{path}.nbt').read_bytes())
                for child in connections(child_data):
                    if child['name']!=c['target']:continue
                    for cr in range(4):
                        if rotation(child['front'],cr)!=tuple(-v for v in front) or rotation(child['top'],cr)!=top:continue
                        origin=sub(anchor,rotation(child['pos'],cr));box=bounds(origin,cr,child_data)
                        if max(abs(box[0]-21),abs(box[2]-21),abs(box[3]-21),abs(box[5]-21))>128:continue
                        if any(all(box[i]<old[i+3] and old[i]<box[i+3] for i in range(3)) for old in boxes):continue
                        pieces.append((child_loc,origin,cr,child_data));boxes.append(box)
                        joints.append({'from':parent_loc,'pool':pool,'parent':list(parent_pos),'child':list(anchor),'direction':list(front)})
                        enqueue(child_loc,child_data,origin,cr,depth+1,child['pos']);attached=True;break
                    if attached:break
                if attached:break
            if attached:break
            pool=definition['fallback']
        if not attached:omitted['unfilled_structural_connector']+=1
    assert len(pieces)>10,('Fortress assembly unexpectedly small',len(pieces))
    return pieces,joints,dict(omitted)

def block_state(name,props,schema):
    original=name;short=name.split(':')[1]
    if short in ('nether_wart','jigsaw','cave_air','void_air'):name='minecraft:air';props={}
    elif short=='structure_void':return None
    elif short.endswith('_bed'):name='minecraft:bed'
    elif short.startswith('potted_'):name='minecraft:flower_pot'
    elif short.endswith('_wall_banner'):name='minecraft:wall_banner'
    elif short.endswith('_banner'):name='minecraft:standing_banner'
    elif short=='orange_stained_glass':name='minecraft:deepslate';props={} # Pillar-processor marker.
    elif short=='repeater':name='minecraft:'+('powered_' if props.get('powered')=='true' else 'unpowered_')+'repeater'
    elif short=='comparator':name='minecraft:'+('powered_' if props.get('powered')=='true' else 'unpowered_')+'comparator'
    elif short=='piston_head':name='minecraft:'+('sticky_' if props.get('type')=='sticky' else '')+'piston_arm_collision'
    else:name='minecraft:'+ALIASES.get(short,short)
    if name.endswith('_slab') and props.get('type')=='double':name=name.replace('_slab','_double_slab')
    if name=='minecraft:redstone_torch' and props.get('lit')=='false':name='minecraft:unlit_redstone_torch'
    assert name in schema,('Unmapped block',original,name)
    fields=schema[name];states={k:meta['values'][0] for k,meta in fields.items()}
    face=props.get('facing','north')
    for key in states:
        if key=='minecraft:cardinal_direction':states[key]=face
        elif key=='minecraft:facing_direction':states[key]=face
        elif key=='facing_direction':states[key]=FACING[face]
        elif key=='pillar_axis':states[key]=props.get('axis','y')
        elif key=='minecraft:vertical_half':states[key]='top' if props.get('type')=='top' else 'bottom'
        elif key=='minecraft:corner':states[key]={'straight':'none'}.get(props.get('shape'),props.get('shape','none'))
        elif key=='weirdo_direction':states[key]={'east':0,'west':1,'south':2,'north':3}[face]
        elif key=='upside_down_bit':states[key]=props.get('half')=='top'
        elif key=='wall_post_bit':states[key]=props.get('up')=='true'
        elif key.startswith('wall_connection_type_'):states[key]={'low':'short','none':'none','tall':'tall'}.get(props.get(key.split('_')[-1]),'none')
        elif key.startswith('minecraft:connection_'):states[key]=props.get(key.split('_')[-1])=='true'
        elif key=='redstone_signal':states[key]=int(props.get('power',15 if props.get('powered')=='true' else 0))
        elif key=='direction':
            states[key]=({'east':0,'west':1,'south':2,'north':3} if (name.endswith('_trapdoor') or name=='minecraft:trapdoor') else DIRECTION)[face]
        elif key=='torch_facing_direction':states[key]={'east':'west','west':'east','north':'south','south':'north'}.get(face,'top')
        elif key=='ground_sign_direction':states[key]=int(props.get('rotation',0))
        elif key=='upper_block_bit':states[key]=props.get('half')=='upper'
        elif key=='door_hinge_bit':states[key]=props.get('hinge')=='right'
        elif key=='head_piece_bit':states[key]=props.get('part')=='head'
        elif key=='occupied_bit':states[key]=props.get('occupied')=='true'
        elif key=='open_bit':states[key]=props.get('open')=='true'
        elif key in ('powered_bit','button_pressed_bit','output_lit_bit'):states[key]=props.get('powered')=='true'
        elif key=='triggered_bit':states[key]=props.get('triggered')=='true'
        elif key=='attached_bit':states[key]=props.get('attached')=='true'
        elif key=='disarmed_bit':states[key]=props.get('disarmed')=='true'
        elif key=='toggle_bit':states[key]=props.get('enabled','true')=='true'
        elif key=='hanging':states[key]=props.get('hanging')=='true' or props.get('vertical_direction')=='down'
        elif key=='liquid_depth':states[key]=int(props.get('level',0))
        elif key=='weeping_vines_age':states[key]=int(props.get('age',0))
        elif key=='ominous':states[key]=props.get('ominous')=='true'
        elif key=='trial_spawner_state':states[key]={'inactive':0,'waiting_for_players':1,'active':2,'waiting_for_reward_ejection':3,'ejecting_reward':4,'cooldown':5}.get(props.get('trial_spawner_state'),0)
        elif key=='vault_state':states[key]=props.get('vault_state','inactive')
        elif key=='dripstone_thickness':states[key]='merge' if props.get('thickness')=='tip_merge' else props.get('thickness','tip')
        elif key=='respawn_anchor_charge':states[key]=int(props.get('charges',0))
        elif key=='repeater_delay':states[key]=int(props.get('delay',1))-1
        elif key=='output_subtract_bit':states[key]=props.get('mode')=='subtract'
        elif key=='attachment':states[key]={'floor':'standing','ceiling':'hanging','wall':'side'}.get(props.get('face'),'standing')
        elif key=='extinguished':states[key]=props.get('lit','true')!='true'
        elif key=='brushed_progress':states[key]=int(props.get('dusted',0))
        elif key=='fill_level':states[key]=int(props.get('level',0))*2
    for key,val in states.items():assert val in fields[key]['values'],(original,key,val)
    tagged={k:(1,int(v)) if fields[k]['type']=='bool' else (3,v) if fields[k]['type']=='int' else (8,v) for k,v in states.items()}
    return {'name':(8,name),'states':(10,tagged),'version':(3,(1<<24)|(26<<16)|(50<<8))}

def item(data):
    name=value(data,'id');count=value(data,'count',value(data,'Count',1))
    if not name or not name.startswith('minecraft:'):return None
    result={'Name':(8,name),'Count':(1,min(64,count)),'Damage':(2,0)}
    if 'Slot' in data:result['Slot']=(1,value(data,'Slot'))
    return result

def block_entity(name,source,pos,arena):
    ids={'minecraft:chest':'Chest','minecraft:trapped_chest':'Chest','minecraft:barrel':'Barrel',
         'minecraft:dispenser':'Dispenser','minecraft:dropper':'Dropper','minecraft:hopper':'Hopper',
         'minecraft:wall_banner':'Banner','minecraft:standing_banner':'Banner','minecraft:mob_spawner':'MobSpawner',
         'minecraft:blast_furnace':'BlastFurnace','minecraft:lectern':'Lectern','minecraft:soul_campfire':'Campfire',
         'minecraft:bed':'Bed','minecraft:flower_pot':'FlowerPot','minecraft:skeleton_skull':'Skull',
         'minecraft:darkoak_wall_sign':'Sign','minecraft:noteblock':'Music',
         'minecraft:unpowered_comparator':'Comparator','minecraft:powered_comparator':'Comparator'}
    if name not in ids:return None
    e={'id':(8,ids[name]),'isMovable':(1,1),**{k:(3,v) for k,v in zip(('x','y','z'),pos)}}
    if ids[name] in ('Chest','Barrel'):
        e['LootTable']=(8,'loot_tables/chests/underworld_structure.json')
    elif ids[name] in ('Dispenser','Dropper','Hopper'):
        e['Items']=(9,(10,[v for d in value(source,'Items',(10,[]))[1] if (v:=item(d))]))
    elif ids[name]=='Banner':
        color=value(source,'_java_block','minecraft:red_wall_banner').split(':')[1].replace('_wall_banner','').replace('_banner','')
        e['Base']=(3,0 if color=='black' else 1)
        patterns=[];codes={'stripe_bottom':'bs','stripe_top':'ts','stripe_left':'ls','stripe_right':'rs','stripe_center':'cs','stripe_middle':'ms','cross':'cr','straight_cross':'sc','border':'bo','circle':'mc','rhombus':'mr','gradient':'gra','gradient_up':'gru','skull':'sku','piglin':'pig','flower':'flo','creeper':'cre','mojang':'moj'}
        colors=['black','red','green','brown','blue','purple','cyan','light_gray','gray','pink','lime','yellow','light_blue','magenta','orange','white']
        for p in value(source,'patterns',(10,[]))[1]:
            pat=value(p,'pattern','').split(':')[-1];color=value(p,'color','red')
            if pat in codes and color in colors:patterns.append({'Pattern':(8,codes[pat]),'Color':(3,colors.index(color))})
        e['Patterns']=(9,(10,patterns))
    elif ids[name]=='Bed':e['color']=(1,0)
    elif ids[name]=='Skull':e.update({'SkullType':(1,0),'Rot':(5,0.0)})
    elif ids[name]=='FlowerPot':
        plant=value(source,'_java_block','').split(':')[-1]
        if plant.startswith('potted_'):
            plant=plant.removeprefix('potted_');plant='deadbush' if plant=='dead_bush' else plant
            e['PlantBlock']=(10,block_state('minecraft:'+plant,{},json.loads(SCHEMA.read_text())['blocks']))
    elif ids[name]=='Music':e.update({'note':(1,0),'powered':(1,0)})
    elif ids[name]=='MobSpawner':
        targets={'small_arena':['minecraft:zombie_pigman','minecraft:magma_cube','minecraft:skeleton'],
                 'large_arena':['minecraft:wither_skeleton','minecraft:skeleton'],
                 'dragon_arena':['minecraft:wither_skeleton','minecraft:blaze','minecraft:magma_cube']}
        choices=targets.get(arena,['minecraft:wither_skeleton','minecraft:blaze','minecraft:magma_cube'] if arena=='mega_fortress' else ['minecraft:wither_skeleton'])
        entity=choices[int(hashlib.sha256(str(pos).encode()).hexdigest()[:8],16)%len(choices)]
        e.update({'EntityIdentifier':(8,entity),'Delay':(2,200),'MinSpawnDelay':(2,200),'MaxSpawnDelay':(2,800),
                  'SpawnCount':(2,3),'MaxNearbyEntities':(2,6),'RequiredPlayerRange':(2,16),'SpawnRange':(2,4)})
    return e

def convert(arena,schema):
    pieces,joints,omitted=assemble(arena);points=[]
    for _,o,r,d in pieces:
        size=d['size'][1][1]
        points.extend(add(o,rotation((x,y,z),r)) for x in [0,size[0]-1] for y in [0,size[1]-1] for z in [0,size[2]-1])
    low=tuple(min(p[i] for p in points) for i in range(3));high=tuple(max(p[i] for p in points) for i in range(3))
    total=tuple(high[i]-low[i]+1 for i in range(3));blocks={};entities={};water={};palette=[];lookup={};stats=collections.Counter()
    def state_id(state):
        key=repr(state)
        if key not in lookup:lookup[key]=len(palette);palette.append(state)
        return lookup[key]
    water_id=state_id(block_state('minecraft:water',{'level':'0'},schema))
    for loc,o,r,d in pieces:
        source_palette=d['palette'][1][1]
        for b in d['blocks'][1][1]:
            raw=source_palette[value(b,'state')];name=value(raw,'Name');props=rotate_properties({k:v[1] for k,v in value(raw,'Properties',{}).items()},r);source=dict(value(b,'nbt',{}));source['_java_block']=(8,name)
            if name=='minecraft:jigsaw':
                stats['jigsaw_markers_resolved']+=1;final=value(source,'final_state','minecraft:air');name,_,suffix=final.partition('[');props=dict(v.split('=',1) for v in suffix.rstrip(']').split(',') if v)
            if name=='minecraft:nether_wart':stats['wart_removed']+=1
            state=block_state(name,props,schema)
            if state is None:continue
            pos=sub(add(o,rotation(tuple(b['pos'][1][1]),r)),low);blocks[pos]=state_id(state);entities.pop(pos,None);water.pop(pos,None)
            if props.get('waterlogged')=='true':water[pos]=water_id
            e=block_entity(state['name'][1],source,pos,arena)
            if e:entities[pos]=e;stats['native_'+e['id'][1]]+=1
            if name in ('minecraft:trial_spawner','minecraft:vault'):stats['unported_'+name.split(':')[1]+'_configuration']+=1
        for ent in value(d,'entities',(10,[]))[1]:stats['omitted_java_'+value(ent['nbt'][1],'id','unknown')]+=1
    sections=[]
    out=ROOT/'behavior_pack/structures/jagsby_nether/arenas'/arena;out.mkdir(parents=True,exist_ok=True)
    for x0 in range(0,total[0],64):
        for z0 in range(0,total[2],64):
            size=(min(64,total[0]-x0),total[1],min(64,total[2]-z0));volume=math.prod(size);primary=[-1]*volume;secondary=[-1]*volume;position_data={}
            for pos,idx in blocks.items():
                x,y,z=pos
                if not (x0<=x<x0+size[0] and z0<=z<z0+size[2]):continue
                relative=(x-x0,y,z-z0);index=(relative[0]*size[1]+y)*size[2]+relative[2];primary[index]=idx
                if pos in water:secondary[index]=water[pos]
                if pos in entities:
                    e=dict(entities[pos]);e.update({k:(3,v) for k,v in zip(('x','y','z'),relative)})
                    position_data[str(index)]=(10,{'block_entity_data':(10,e)})
            root={'format_version':(3,1),'size':(9,(3,list(size))),'structure_world_origin':(9,(3,[0,0,0])),
                  'structure':(10,{'block_indices':(9,(9,[(3,primary),(3,secondary)])), 'entities':(9,(10,[])),
                                  'palette':(10,{'default':(10,{'block_palette':(9,(10,palette)),'block_position_data':(10,position_data)})})})}
            w=NBT();w.write('B',10);w.put_string('');w.put(10,root);tile=f'section_{x0//64}_{z0//64}'
            (out/f'{tile}.mcstructure').write_bytes(w.stream.getvalue())
            sections.append({'id':f'jagsby_nether:arenas/{arena}/{tile}','offset':[x0,0,z0],'size':list(size)})
    return {'display_name':arena.replace('_',' ').title(),'size':list(total),'spawn_enabled':False,'sections':sections,
            'source_pieces':[{'location':loc,'offset':list(sub(o,low)),'rotation':r*90} for loc,o,r,d in pieces],
            'joins':joints,'omitted_encounter_pools':omitted,'conversion_counts':dict(stats)}

def extract(jar):
    SOURCE.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(jar) as z:
        selected=set()
        for name in z.namelist():
            if any('/worldgen/template_pool/'+a+'/' in name for a in ARENAS) and name.endswith('.json'):
                d=json.loads(z.read(name));selected.add(name)
                for entry in d['elements']:
                    e=entry['element']
                    if 'location' not in e:continue
                    loc=next((v for k,v in e.get('locations',{}).items() if k.split('-')[0]=='1.21'),e['location']);ns,path=loc.split(':')
                    selected.add(f'data/{ns}/structure/{path}.nbt')
        for a in ARENAS:
            definition=f'data/mns/worldgen/structure/{a}.json';selected.add(definition)
            pool=json.loads(z.read(definition))['start_pool'].split(':')[1]
            path=f'data/mns/worldgen/template_pool/{pool}.json'
            selected.add(path)
            d=json.loads(z.read(path))
            for entry in d['elements']:
                e=entry['element']
                if 'location' not in e:continue
                loc=next((v for k,v in e.get('locations',{}).items() if k.split('-')[0]=='1.21'),e['location']);ns,path=loc.split(':')
                selected.add(f'data/{ns}/structure/{path}.nbt')
        for name in list(selected):
            if '/template_pool/' not in name:continue
            for entry in json.loads(z.read(name))['elements']:
                proc=entry['element'].get('processors','minecraft:empty')
                if isinstance(proc,str) and proc.startswith('mns:'):
                    selected.add('data/mns/worldgen/processor_list/'+proc.split(':')[1]+'.json')
        for name in sorted(selected):
            target=SOURCE/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
        return {name:hashlib.sha256(z.read(name)).hexdigest() for name in sorted(selected)}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--jar',type=Path);args=parser.parse_args()
    old=ROOT/'MOOGS_ARENAS_SOURCE.json'
    metadata=json.loads(old.read_text()) if old.exists() else {}
    if args.jar:metadata.update({'jar_file':args.jar.name,'jar_sha256':hashlib.sha256(args.jar.read_bytes()).hexdigest(),'source_files_sha256':extract(args.jar)})
    schema=json.loads(SCHEMA.read_text())['blocks'];catalog={a:convert(a,schema) for a in ARENAS}
    metadata.update({'mod':'Moogs Nether Structures','version':'3.1.1','authors':['FinnDog','Phantax (structure builder)'],
                     'upstream':'https://github.com/FinnSetchell/MoogsNetherStructures2','license':'LGPL-3.0',
                     'scope':'Seven Java 1.21 structure layouts for manual Bedrock testing only; no natural placement/spawn rules.',
                     'limitations':['Custom Java boss/mob encounter pools omitted.','Java trial-spawner and vault configurations are not ported; blocks retain default native behavior.',
                                    'Java terrain carving and 128-block support pillar processors are not run.',
                                    'Chests/barrels use Underworld loot. Vanilla spawners use native Nether mobs. Java item-frame entity omitted.',
                                    'Nether Wart plants removed; Nether Wart construction blocks retained.'],
                     'converted_templates':catalog})
    old.write_text(json.dumps(metadata,indent=2)+'\n')
    target=ROOT/'behavior_pack/scripts/arena_catalog.js';target.write_text('export const ARENAS = '+json.dumps({a:{k:v for k,v in d.items() if k in ['display_name','size','sections','spawn_enabled']} for a,d in catalog.items()},separators=(',',':'))+';\n')
    print(json.dumps({a:{'size':d['size'],'pieces':len(d['source_pieces']),'sections':len(d['sections'])} for a,d in catalog.items()},indent=2))

if __name__=='__main__':main()
