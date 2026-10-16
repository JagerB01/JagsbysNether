"""Restore native double-chest links in imported layouts, including tile seams."""
import json
from pathlib import Path
from structure_crops import NBT
from structure_loot import chest_records, pair_chest_records, LOOT_TABLE, SMALL_ARENA_LOOT_TABLE
ROOT=Path(__file__).resolve().parents[1]
def catalog(name):
    return json.loads((ROOT/'behavior_pack/scripts'/name).read_text().split(' = ',1)[1].rstrip(';\n'))
def process(sections,loot_table=None):
    documents=[];records={}
    for section in sections:
        path=ROOT/'behavior_pack/structures'/f"{section['id'].replace(':','/')}.mcstructure"
        reader=NBT(path.read_bytes());reader.read('B');name=reader.string();root=reader.payload(10)
        documents.append((path,name,root));records.update(chest_records(root,section['offset']))
    changed=pair_chest_records(records)
    if loot_table:
        for record in records.values():
            entity=record['entity']
            if entity.get('LootTable')==(8,LOOT_TABLE) and not entity.get('Items',(9,(10,[])))[1][1]:
                entity['LootTable']=(8,loot_table);changed.add((id(record['root']),record['index']))
    changed_roots={root_id for root_id,_ in changed}
    for path,name,root in documents:
        if id(root) not in changed_roots:continue
        writer=NBT();writer.write('B',10);writer.put_string(name);writer.put(10,root);path.write_bytes(writer.stream.getvalue())
    return len(changed)
def update():
    count=0
    for name in ('arena_catalog.js','natural_arena_catalog.js'):
        for arena_id,arena in catalog(name).items():count+=process(arena['sections'],SMALL_ARENA_LOOT_TABLE if arena_id=='small_arena' else None)
    for module in catalog('modular_fortress_catalog.js'):count+=process(module['sections'])
    print(f'Native double-chest pairing: {count} chest halves repaired')
if __name__=='__main__':update()
