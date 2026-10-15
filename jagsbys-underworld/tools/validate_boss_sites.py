"""Check dormant-boss floor/clearance against actual converted structure blocks."""
import json
import math
from pathlib import Path
from structure_crops import NBT

ROOT = Path(__file__).resolve().parents[1]

def validate(base=ROOT):
    spec = json.loads((ROOT / 'BOSS_PLACEMENTS.json').read_text())
    catalog = json.loads((base / 'behavior_pack/scripts/infernal_lords/boss_sites.js').read_text().split(' = ',1)[1].rstrip().removesuffix(';'))
    assert catalog == spec['sites'], 'Boss catalog differs from verified source positions'
    metadata = json.loads((ROOT / 'MOOGS_ARENAS_SOURCE.json').read_text())
    natural = json.loads((base / 'behavior_pack/scripts/natural_arena_catalog.js').read_text().split(' = ',1)[1].rstrip().removesuffix(';'))
    modules = json.loads((base / 'behavior_pack/scripts/modular_fortress_catalog.js').read_text().split(' = ',1)[1].rstrip().removesuffix(';'))
    cache = {}
    def block(sections,x,y,z):
        for section in sections:
            ox,oy,oz = section['offset']; sx,sy,sz = section['size']
            if ox<=x<ox+sx and oy<=y<oy+sy and oz<=z<oz+sz:
                identifier = section['id']
                if identifier not in cache:
                    path = base / 'behavior_pack/structures' / (identifier.replace(':','/')+'.mcstructure')
                    reader = NBT(path.read_bytes()); reader.read('B'); reader.string()
                    data = reader.payload(10)['structure'][1]
                    cache[identifier] = (data['block_indices'][1][1][0][1],data['palette'][1]['default'][1]['block_palette'][1][1])
                indices,palette = cache[identifier]
                index = indices[(x-ox)*sy*sz+(y-oy)*sz+z-oz]
                return 'minecraft:air' if index<0 else palette[index]['name'][1]
        raise AssertionError(f'Boss site outside placed sections: {(x,y,z)}')
    checked = 0
    for identifier,site in spec['sites'].items():
        variants = [('manual',metadata['converted_templates'][identifier]['sections'],site['offset']),('natural',natural[identifier]['sections'],site['offset'])]
        if 'modularOffset' in site:
            variants.append(('modular keep',modules[0]['sections'],site['modularOffset']))
        for label,sections,offset in variants:
            x,y,z = map(math.floor,offset); radius=site['clearanceRadius']
            for xx in range(x-radius,x+radius+1):
                for zz in range(z-radius,z+radius+1):
                    floor = block(sections,xx,y-1,zz)
                    assert floor not in ('minecraft:air','minecraft:lava','minecraft:flowing_lava','minecraft:magma'), f'{identifier} {label}: unsupported/hazardous floor {floor}'
                    for yy in range(y,y+site['clearanceHeight']):
                        assert block(sections,xx,yy,zz)=='minecraft:air', f'{identifier} {label}: obstructed at {(xx,yy,zz)}'
            checked += 1
    # Exact midpoint of the four authored roof trial spawners, not a bounding-box guess.
    site=spec['sites']['mega_fortress']['offset']
    assert site[0] == ((117+.5)+(127+.5))/2 and site[2] == ((120+.5)+(130+.5))/2
    print(f'Boss sites: floor and clearance verified in {checked} manual/natural/modular layouts')

if __name__=='__main__':
    import sys
    validate(ROOT/'.build' if '--built' in sys.argv else ROOT)
