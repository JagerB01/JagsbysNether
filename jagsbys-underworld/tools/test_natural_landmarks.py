"""Check sliced native placement preserves every original block and block entity."""
import json,unittest
from pathlib import Path
from structure_crops import NBT
ROOT=Path(__file__).resolve().parents[1]
def read(identifier):
    r=NBT((ROOT/'behavior_pack/structures'/f"{identifier.replace(':','/')}.mcstructure").read_bytes());r.read('B');r.string();return r.payload(10)
def catalog(name):return json.loads((ROOT/'behavior_pack/scripts'/name).read_text().split(' = ',1)[1].rstrip(';\n'))
class NaturalTiles(unittest.TestCase):
    def test_tiles_preserve_blocks_and_block_entities_without_gaps(self):
        originals=catalog('arena_catalog.js');natural=catalog('natural_arena_catalog.js')
        for name,a in originals.items():
            tiles=natural[name]['sections'];self.assertEqual(natural[name]['size'],a['size']);total=0
            for source in a['sections']:
                root=read(source['id']);st=root['structure'][1];sx,sy,sz=source['size'];ox,_,oz=source['offset'];covered=set()
                relevant=[t for t in tiles if ox<=t['offset'][0]<ox+sx and oz<=t['offset'][2]<oz+sz]
                for tile in relevant:
                    data=read(tile['id']);nx,ny,nz=tile['size'];self.assertLessEqual(nx,16);self.assertLessEqual(nz,16);self.assertEqual(ny,sy)
                    tx,tz=tile['offset'][0]-ox,tile['offset'][2]-oz;tst=data['structure'][1];total+=nx*ny*nz
                    self.assertEqual(tst['palette'][1]['default'][1]['block_palette'],st['palette'][1]['default'][1]['block_palette'])
                    for x in range(nx):
                        for z in range(nz):
                            self.assertNotIn((x+tx,z+tz),covered);covered.add((x+tx,z+tz))
                    for (_,layer),(_,original) in zip(tst['block_indices'][1][1],st['block_indices'][1][1]):
                        expected=[original[(x+tx)*sy*sz+y*sz+z+tz] for x in range(nx) for y in range(sy) for z in range(nz)]
                        self.assertEqual(layer,expected)
                    old=st['palette'][1]['default'][1]['block_position_data'][1]
                    actual=tst['palette'][1]['default'][1]['block_position_data'][1];expected_count=0
                    for key,e in old.items():
                        x,rem=divmod(int(key),sy*sz);y,z=divmod(rem,sz)
                        if tx<=x<tx+nx and tz<=z<tz+nz:
                            expected_count+=1;n=(x-tx)*sy*nz+y*nz+z-tz;got=actual[str(n)][1]['block_entity_data'][1];original=e[1]['block_entity_data'][1]
                            self.assertEqual(got['x'][1],x-tx);self.assertEqual(got['y'][1],y);self.assertEqual(got['z'][1],z-tz)
                            self.assertEqual({k:v for k,v in got.items() if k not in ('x','z')},{k:v for k,v in original.items() if k not in ('x','z')})
                    self.assertEqual(len(actual),expected_count)
                self.assertEqual(len(covered),sx*sz)
            self.assertEqual(total,a['size'][0]*a['size'][1]*a['size'][2])
if __name__=='__main__':unittest.main()
