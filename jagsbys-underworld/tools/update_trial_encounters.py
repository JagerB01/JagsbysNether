"""Bake native TrialSpawner presets and location catalogs; no runtime terrain scanning."""
import copy,hashlib,json
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'TRIAL_ENCOUNTERS.json'
def read(path):
 r=NBT(path.read_bytes());kind=r.read('B');name=r.string();return kind,name,r.payload(kind)
def write(path,root,name=''):
 w=NBT();w.write('B',10);w.put_string(name);w.put(10,root);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(w.stream.getvalue())
def catalog(file):return json.loads((ROOT/'behavior_pack/scripts'/file).read_text().split(' = ',1)[1].rstrip(';\n'))
def trial_entity(profile,config,pos):
 group,role=profile.split('/');mob=config['groups'][group][role];defaults=config['defaults']
 e={'id':(8,'TrialSpawner'),'isMovable':(1,0),**{k:(3,v) for k,v in zip(('x','y','z'),pos)},
    'required_player_range':(3,defaults['required_player_range']),'cooldown_end_at':(4,0),
    'next_mob_spawns_at':(4,0),'total_mobs_spawned':(3,0),'registered_players':(9,(10,[])),'current_mobs':(9,(10,[]))}
 if mob:
  # Leave spawn_data unselected: the native spawner rolls this pool.
  e['spawn_potentials']=(9,(10,[{'TypeId':(8,p['entity']),'Weight':(3,p['weight'])} for p in config['spawn_pool']]))
  settings={k:(5,float(v)) if k in ['total_mobs','total_mobs_added_per_player','simultaneous_mobs','simultaneous_mobs_added_per_player'] else (3,v)
            for k,v in defaults.items() if k!='required_player_range'}
  settings['spawn_potentials']=copy.deepcopy(e['spawn_potentials'])
  e['normal_config']=(10,copy.deepcopy(settings));e['ominous_config']=(10,copy.deepcopy(settings))
 return e
def profile_for(group,entity):
 # Keep role IDs stable after conversion even when their configured mob changes.
 return group+'/'+entity['EntityIdentifier'][1].split(':')[-1] if entity and 'EntityIdentifier' in entity else group+'/weighted'
def process(sections,group,config,only=None,prior=None):
 slots=[]
 prior={tuple(s['offset']):s['profile'] for s in prior or []}
 for section in sections:
  path=ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure";_,name,root=read(path);st=root['structure'][1];sx,sy,sz=section['size'];ox,oy,oz=section['offset']
  default=st['palette'][1]['default'][1];palette=default['block_palette'][1][1];layer=st['block_indices'][1][1][0][1];positions=default.setdefault('block_position_data',(10,{}))[1];changed=False
  for i,pi in enumerate(layer):
   if pi<0 or palette[pi]['name'][1] not in ['minecraft:mob_spawner','minecraft:trial_spawner']:continue
   x,rem=divmod(i,sy*sz);y,z=divmod(rem,sz);offset=[x+ox,y+oy,z+oz]
   if only is not None and tuple(offset) not in only:continue
   original=positions.get(str(i),(10,{}))[1].get('block_entity_data',(10,{}))[1]
   profile=prior.get(tuple(offset)) or profile_for(group,original)
   assert profile.split('/')[1] in config['groups'][group],profile
   state=copy.deepcopy(palette[pi]);state['name']=(8,'minecraft:trial_spawner');state['states']=(10,{'ominous':(1,0),'trial_spawner_state':(3,1 if config['groups'][group][profile.split('/')[1]] else 0)})
   if state not in palette:palette.append(state)
   layer[i]=palette.index(state)
   positions[str(i)]=(10,{'block_entity_data':(10,trial_entity(profile,config,(x,y,z)))})
   slots.append({'offset':offset,'profile':profile});changed=True
  if changed:write(path,root,name)
 return sorted(slots,key=lambda s:s['offset'])
def generate():
 config=json.loads(DATA.read_text());arenas=catalog('arena_catalog.js');modules=catalog('modular_fortress_catalog.js');prior={}
 location_file=ROOT/'behavior_pack/scripts/trial_encounter_catalog.js'
 if location_file.exists():prior=json.loads(location_file.read_text().split(' = ',1)[1].rstrip(';\n'))['sites']
 from relocate_trial_spawners import relocate
 for name in ['small_arena','large_arena','dragon_arena']:
  relocate(arenas[name]['sections'],[m for m in config.get('relocations',[]) if m['layout']==name],ROOT,read,write)
 sites={name:process(arenas[name]['sections'],name,config,prior=prior.get(name)) for name in ['small_arena','large_arena','dragon_arena']}
 core=process([s for m in modules[:5] for s in m['sections']],'mega_keep',config,prior=prior.get('mega_modular'))
 sites['mega_modular']=core
 # Manual full-fortress origin differs from the modular keep-centre origin.
 meta=json.loads((ROOT/'MOOGS_ARENAS_SOURCE.json').read_text())['converted_templates']['mega_fortress']
 centre=meta['source_pieces'][0]['offset'];translated=[{'offset':[s['offset'][0]+21+centre[0],s['offset'][1]+centre[1],s['offset'][2]+21+centre[2]],'profile':s['profile']} for s in core]
 sites['mega_fortress']=process(arenas['mega_fortress']['sections'],'mega_keep',config,only={tuple(s['offset']) for s in translated},prior=translated)
 presets={}
 for group,roles in config['groups'].items():
  for role,mob in roles.items():
   profile=group+'/'+role;identifier='jagsby_nether:trial_encounters/'+group+'_'+role
   presets[profile]=identifier
   block={'name':(8,'minecraft:trial_spawner'),'states':(10,{'ominous':(1,0),'trial_spawner_state':(3,1 if mob else 0)}),'version':(3,18493952)}
   default={'block_palette':(9,(10,[block])),
            'block_position_data':(10,{'0':(10,{'block_entity_data':(10,trial_entity(profile,config,(0,0,0)))})})}
   structure={'block_indices':(9,(9,[(3,[0]),(3,[-1])])),
              'entities':(9,(10,[])), 'palette':(10,{'default':(10,default)})}
   root={'format_version':(3,1),'size':(9,(3,[1,1,1])),
         'structure_world_origin':(9,(3,[0,0,0])),'structure':(10,structure)}
   write(ROOT/'behavior_pack/structures'/f"{identifier.replace(':','/')}.mcstructure",root)
 revision=hashlib.sha256(json.dumps({'config':{'defaults':config['defaults'],'groups':config['groups'],'spawn_pool':config['spawn_pool']},'sites':sites},sort_keys=True).encode()).hexdigest()[:16]
 legacy={name:[{'offset':m['from'],'profile':name+'/weighted'} for m in config.get('relocations',[]) if m['layout']==name] for name in ['small_arena','large_arena','dragon_arena']}
 result={'revision':revision,'presets':presets,'sites':sites,'legacySites':legacy}
 location_file.write_text('export const TRIAL_ENCOUNTERS = '+json.dumps(result,separators=(',',':'))+';\n')
 from generate_natural_landmarks import generate as natural
 natural()
 print('Native trial encounters:',{k:len(v) for k,v in sites.items()},'revision',revision)
if __name__=='__main__':generate()
