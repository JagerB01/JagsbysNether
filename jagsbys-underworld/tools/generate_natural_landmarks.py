"""Slice converted templates for incremental natural placement, without changing blocks."""
import copy,json
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
def generate(only=None):
    arenas=json.loads((ROOT/'behavior_pack/scripts/arena_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n'));catalog=json.loads((ROOT/'behavior_pack/scripts/natural_arena_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n')) if only else {}
    for name,a in arenas.items():
        if only and name!=only:continue
        sections=[]
        # Ground foundations follow the authored lowest layers, including the
        # Dragon island and the Small Arena's irregular outline, read offline.
        base={};build=set()
        if name in ('dragon_arena','small_arena'):
            for source in a['sections']:
                r=NBT((ROOT/'behavior_pack/structures'/f"{source['id'].replace(':','/')}.mcstructure").read_bytes());r.read('B');r.string();root=r.payload(10)
                st=root['structure'][1];names=[b['name'][1] for b in st['palette'][1]['default'][1]['block_palette'][1][1]]
                layer=st['block_indices'][1][1][0][1];sx,sy,sz=source['size'];ox,oy,oz=source['offset']
                for x in range(sx):
                    for z in range(sz):
                        for y in range(min(sy,max(0,2-oy))):
                            i=layer[(x*sy+y)*sz+z]
                            if i>=0 and names[i] not in {'minecraft:air','minecraft:lava','minecraft:water','minecraft:flowing_lava','minecraft:flowing_water'}:
                                base[x+ox,z+oz]=y+oy;break
        if name=='small_arena':
            for source in a['sections']:
                path=ROOT/'behavior_pack/structures'/f"{source['id'].replace(':','/')}.mcstructure"
                reader=NBT(path.read_bytes());reader.read('B');root_name=reader.string();root=reader.payload(10)
                st=root['structure'][1];names=[v['name'][1] for v in st['palette'][1]['default'][1]['block_palette'][1][1]]
                layer=st['block_indices'][1][1][0][1];sx,sy,sz=source['size'];ox,oy,oz=source['offset'];changed=False
                for x in range(sx):
                    for z in range(sz):
                        solid=any((i:=layer[(x*sy+y)*sz+z])>=0 and names[i] not in {'minecraft:air','minecraft:lava','minecraft:water','minecraft:flowing_lava','minecraft:flowing_water'} for y in range(sy))
                        if solid:build.add((x+ox,z+oz))
                        else:
                            for _,indices in st['block_indices'][1][1]:
                                for y in range(sy):
                                    key=(x*sy+y)*sz+z
                                    if indices[key]!=-1:indices[key]=-1;changed=True
                if changed:
                    writer=NBT();writer.write('B',10);writer.put_string(root_name);writer.put(10,root);path.write_bytes(writer.stream.getvalue())
        for section in a['sections']:
            reader=NBT((ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure").read_bytes())
            reader.read('B');reader.string();root=reader.payload(10)
            sx,sy,sz=section['size'];st=root['structure'][1];layers=st['block_indices'][1][1];entities=st['palette'][1]['default'][1]['block_position_data'][1]
            for tx in range(0,sx,16):
                for tz in range(0,sz,16):
                    nx,nz=min(16,sx-tx),min(16,sz-tz)
                    data=copy.deepcopy(root);data['size']=(9,(3,[nx,sy,nz]));newst=data['structure'][1]
                    newst['block_indices']=(9,(9,[(kind,[layer[(x+tx)*sy*sz+y*sz+z+tz] for x in range(nx) for y in range(sy) for z in range(nz)]) for kind,layer in layers]))
                    be={}
                    for key,entry in entities.items():
                        x,rem=divmod(int(key),sy*sz);y,z=divmod(rem,sz)
                        if tx<=x<tx+nx and tz<=z<tz+nz:
                            e=copy.deepcopy(entry);compound=e[1]['block_entity_data'][1];compound['x']=(3,x-tx);compound['z']=(3,z-tz)
                            if 'pairx' in compound:compound['pairx']=(3,compound['pairx'][1]-tx)
                            if 'pairz' in compound:compound['pairz']=(3,compound['pairz'][1]-tz)
                            be[str((x-tx)*sy*nz+y*nz+z-tz)]=e
                    newst['palette'][1]['default'][1]['block_position_data']=(10,be)
                    ox,oy,oz=section['offset'];identifier=f'jagsby_nether:arenas_natural/{name}/tile_{ox+tx}_{oz+tz}'
                    path=ROOT/'behavior_pack/structures'/f"{identifier.replace(':','/')}.mcstructure";path.parent.mkdir(parents=True,exist_ok=True)
                    writer=NBT();writer.write('B',10);writer.put_string('');writer.put(10,data);path.write_bytes(writer.stream.getvalue())
                    tile={'id':identifier,'offset':[ox+tx,oy,oz+tz],'size':[nx,sy,nz]}
                    if name in ('dragon_arena','small_arena'):
                        tile['foundationColumns']=[[x,z,base[x+ox+tx,z+oz+tz]-oy,
                            any((x+ox+tx+dx,z+oz+tz+dz) not in base for dx,dz in [(1,0),(-1,0),(0,1),(0,-1)])]
                            for x in range(nx) for z in range(nz) if (x+ox+tx,z+oz+tz) in base]
                    if name=='small_arena':
                        # Merge equal row runs into rectangular native query/carve volumes.
                        volumes=[];active={}
                        for x in range(nx):
                            runs=[];z=0
                            while z<nz:
                                if (x+ox+tx,z+oz+tz) not in build:z+=1;continue
                                start=z
                                while z<nz and (x+ox+tx,z+oz+tz) in build:z+=1
                                runs.append((start,z-start))
                            current={}
                            for start,length in runs:
                                key=(start,length)
                                if key in active:volume=active[key];volume['size'][0]+=1
                                else:volume={'offset':[x,0,start],'size':[1,sy,length]};volumes.append(volume)
                                current[key]=volume
                            active=current
                        tile['buildVolumes']=volumes
                    sections.append(tile)
        catalog[name]={**a,'sections':sections}
    (ROOT/'behavior_pack/scripts/natural_arena_catalog.js').write_text('export const NATURAL_ARENAS = '+json.dumps(catalog,separators=(',',':'))+';\n')
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--only');generate(parser.parse_args().only)
