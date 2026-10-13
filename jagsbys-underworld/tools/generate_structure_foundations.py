"""Generate support anchors only beneath existing solid template blocks."""
import json
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
def generate():
    catalog=json.loads((ROOT/'behavior_pack/scripts/arena_catalog.js').read_text().split(' = ',1)[1].rstrip(';\n'))
    result={}
    non_support={'minecraft:air','minecraft:lava','minecraft:flowing_lava','minecraft:water','minecraft:flowing_water','minecraft:fire','minecraft:soul_fire'}
    for name,arena in catalog.items():
        anchors=[]
        for section in arena['sections']:
            r=NBT((ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure").read_bytes())
            r.read('B');r.string();root=r.payload(10);st=root['structure'][1]
            palette=st['palette'][1]['default'][1]['block_palette'][1][1];indices=st['block_indices'][1][1][0][1]
            sx,sy,sz=section['size'];cells={}
            for x in range(sx):
                for z in range(sz):
                    for y in range(min(sy,8)):
                        index=indices[x*sy*sz+y*sz+z]
                        if index<0:continue
                        block=palette[index]['name'][1]
                        if block in non_support or any(t in block for t in ('torch','vine','fungus','sprouts','roots','lantern','chain','rail','button')):continue
                        cell=(x//8,z//8);score=(y,abs(x%8-4)+abs(z%8-4))
                        if cell not in cells or score<cells[cell][0]:cells[cell]=(score,[x+section['offset'][0],y,z+section['offset'][2]])
                        break
            anchors.extend(v[1] for v in cells.values())
        result[name]=anchors
    target=ROOT/'behavior_pack/scripts/landmark_foundations.js'
    target.write_text('export const FOUNDATIONS = '+json.dumps(result,separators=(',',':'))+';\n')
if __name__=='__main__':generate()
