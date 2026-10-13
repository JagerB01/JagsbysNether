"""Slice converted templates for incremental natural placement, without changing blocks."""
import copy,json
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
def generate():
    arenas=json.loads((ROOT/'behavior_pack/scripts/arena_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n'));catalog={}
    for name,a in arenas.items():
        sections=[]
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
                            e=copy.deepcopy(entry);compound=e[1]['block_entity_data'][1];compound['x']=(3,x-tx);compound['z']=(3,z-tz);be[str((x-tx)*sy*nz+y*nz+z-tz)]=e
                    newst['palette'][1]['default'][1]['block_position_data']=(10,be)
                    ox,oy,oz=section['offset'];identifier=f'jagsby_nether:arenas_natural/{name}/tile_{ox+tx}_{oz+tz}'
                    path=ROOT/'behavior_pack/structures'/f"{identifier.replace(':','/')}.mcstructure";path.parent.mkdir(parents=True,exist_ok=True)
                    writer=NBT();writer.write('B',10);writer.put_string('');writer.put(10,data);path.write_bytes(writer.stream.getvalue())
                    sections.append({'id':identifier,'offset':[ox+tx,oy,oz+tz],'size':[nx,sy,nz]})
        catalog[name]={**a,'sections':sections}
    (ROOT/'behavior_pack/scripts/natural_arena_catalog.js').write_text('export const NATURAL_ARENAS = '+json.dumps(catalog,separators=(',',':'))+';\n')
if __name__=='__main__':generate()
