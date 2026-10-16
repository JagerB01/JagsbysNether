"""Offline, idempotent swaps into existing decorative blocks; no runtime scans."""
import copy

def relocate(sections,moves,root,read,write):
    loaded={}
    def cell(pos):
        for section in sections:
            ox,oy,oz=section['offset'];sx,sy,sz=section['size'];x,y,z=pos
            if ox<=x<ox+sx and oy<=y<oy+sy and oz<=z<oz+sz:
                path=root/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure"
                if path not in loaded:
                    _,name,data=read(path);loaded[path]=(name,data)
                name,data=loaded[path];st=data['structure'][1];default=st['palette'][1]['default'][1]
                return st,default,((x-ox)*sy+y-oy)*sz+z-oz,(x-ox,y-oy,z-oz)
        raise ValueError(f'Relocation outside template: {pos}')
    def name(c):
        st,d,i,_=c;pi=st['block_indices'][1][1][0][1][i]
        return d['block_palette'][1][1][pi]['name'][1] if pi>=0 else 'unplaced'
    def put(c,state,entry=None):
        st,d,i,xyz=c;palette=d['block_palette'][1][1]
        if state not in palette:palette.append(copy.deepcopy(state))
        st['block_indices'][1][1][0][1][i]=palette.index(state)
        positions=d.setdefault('block_position_data',(10,{}))[1];positions.pop(str(i),None)
        if entry:
            entry=copy.deepcopy(entry);entity=entry[1]['block_entity_data'][1]
            for k,v in zip(('x','y','z'),xyz):entity[k]=(3,v)
            positions[str(i)]=entry
    for m in moves:
        old,new=cell(m['from']),cell(m['to'])
        if name(old)==m['fill'] and name(new)=='minecraft:trial_spawner':continue
        assert name(old) in ('minecraft:mob_spawner','minecraft:trial_spawner'),m
        assert name(new) not in ('minecraft:mob_spawner','minecraft:trial_spawner','minecraft:air','unplaced','minecraft:chest','minecraft:barrel'),m
        st,d,i,_=old;palette=d['block_palette'][1][1];state=palette[st['block_indices'][1][1][0][1][i]]
        entry=d['block_position_data'][1][str(i)]
        fill={'name':(8,m['fill']),'states':(10,{'pillar_axis':(8,'y')} if m['fill']=='minecraft:crimson_stem' else {}),'version':state['version']}
        put(new,state,entry);put(old,fill)
    for path,(name,data) in loaded.items():write(path,data,name)
