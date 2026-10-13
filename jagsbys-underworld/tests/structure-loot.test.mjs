import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const table=JSON.parse(readFileSync(new URL('../behavior_pack/loot_tables/chests/underworld_structure.json',import.meta.url)));
test('structure loot has guaranteed supplies and exactly a 5% custom seed roll without wart',()=>{
 assert.deepEqual(table.pools[0].rolls,{min:4,max:7});
 const seeds=table.pools.find(p=>p.entries.some(e=>e.name.endsWith('_seeds')));
 assert.equal(seeds.rolls,1);assert.equal(seeds.conditions[0].chance,.05);
 assert.deepEqual(seeds.entries.map(e=>e.name),['jagsby_nether:rye_seeds','jagsby_nether:murky_seeds']);
 for(const e of seeds.entries){assert.equal(e.weight,1);assert.deepEqual(e.functions[0].count,{min:1,max:3});}
 for(const pool of table.pools)for(const e of pool.entries){
  assert(!e.name.includes('nether_wart'));
  if(e.name.startsWith('jagsby_nether:'))assert(existsSync(new URL(`../.build/behavior_pack/items/${e.name.split(':')[1]}.json`,import.meta.url)));
 }
});
