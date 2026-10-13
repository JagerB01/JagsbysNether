"""Convert source-connected fortress pieces into independent native modules."""
import collections,json,copy
import convert_moogs_arenas as c
from structure_crops import NBT
ROOT=c.ROOT
def bounds(piece):
 _,o,r,d=piece;s=d['size'][1][1];p=[c.add(o,c.rotation((x,y,z),r)) for x in (0,s[0]-1) for y in (0,s[1]-1) for z in (0,s[2]-1)]
 return [min(v[i] for v in p) for i in range(3)]+[max(v[i] for v in p)+1 for i in range(3)]
def generate():
 pieces,joins,_=c.assemble_fortress();schema=json.loads(c.SCHEMA.read_text())["blocks"];boxes=[bounds(p) for p in pieces]
 parents={0:None}
 for i,j in enumerate(joins,1):
  p=j['parent'];matches=[n for n in range(i) if pieces[n][0]==j['from'] and all(boxes[n][k]<=p[k]<boxes[n][k+3] for k in range(3))]
  assert len(matches)==1,(i,matches);parents[i]=matches[0]
 # The centre and its directly attached roof are mandatory together.
 roof=next(i for i,p in enumerate(pieces) if 'mega_crossing_center_top' in p[0]);groups=[[0,roof]]+[[i] for i in range(1,len(pieces)) if i!=roof];mapping={i:n for n,g in enumerate(groups) for i in g};modules=[]
 for n,g in enumerate(groups):
  layout=([pieces[i] for i in g],[],collections.Counter());folder=f'mega_modular/module_{n}';a=c.convert('mega_fortress',schema,layout,folder)
  low=[min(boxes[i][k] for i in g) for k in range(3)];offset=[low[0]-21,low[1],low[2]-21];sections=[]
  for section in a['sections']:
   path=ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure";reader=NBT(path.read_bytes());reader.read('B');reader.string();root=reader.payload(10);sx,sy,sz=section['size'];st=root['structure'][1];layers=st['block_indices'][1][1];entities=st['palette'][1]['default'][1]['block_position_data'][1]
   for tx in range(0,sx,16):
    for tz in range(0,sz,16):
     nx,nz=min(16,sx-tx),min(16,sz-tz);data=copy.deepcopy(root);data['size']=(9,(3,[nx,sy,nz]));ns=data['structure'][1]
     ns['block_indices']=(9,(9,[(kind,[layer[(x+tx)*sy*sz+y*sz+z+tz] for x in range(nx) for y in range(sy) for z in range(nz)]) for kind,layer in layers]));be={}
     for key,entry in entities.items():
      x,rem=divmod(int(key),sy*sz);y,z=divmod(rem,sz)
      if tx<=x<tx+nx and tz<=z<tz+nz:
       e=copy.deepcopy(entry);e[1]['block_entity_data'][1]['x']=(3,x-tx);e[1]['block_entity_data'][1]['z']=(3,z-tz);be[str((x-tx)*sy*nz+y*nz+z-tz)]=e
     ns['palette'][1]['default'][1]['block_position_data']=(10,be);identifier=f'jagsby_nether:arenas_natural/mega_modular/module_{n}/tile_{tx}_{tz}';out=ROOT/'behavior_pack/structures'/f'{identifier.replace(":","/")}.mcstructure';out.parent.mkdir(parents=True,exist_ok=True);w=NBT();w.write('B',10);w.put_string('');w.put(10,data);out.write_bytes(w.stream.getvalue());sections.append({'id':identifier,'offset':[offset[0]+section['offset'][0]+tx,offset[1],offset[2]+section['offset'][2]+tz],'size':[nx,sy,nz],'foundation':{'x':offset[0],'z':offset[2],'sx':a['size'][0],'sz':a['size'][2]}})
   path.unlink() # only the small placement tiles are needed
  modules.append({'index':n,'parent':None if n==0 else mapping[parents[g[0]]],'offset':offset,'size':a['size'],'sections':sections,'source':[pieces[i][0] for i in g]})
 (ROOT/'behavior_pack/scripts/modular_fortress_catalog.js').write_text('export const FORTRESS_MODULES = '+json.dumps(modules,separators=(',',':'))+';\n');print(len(modules),'modules; core',modules[0]['size'])
if __name__=='__main__':
 generate()
 from update_modular_foundations import update
 update()
