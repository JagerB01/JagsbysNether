import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const table=JSON.parse(readFileSync(new URL('../behavior_pack/loot_tables/chests/underworld_structure.json',import.meta.url)));
test('structure loot has guaranteed supplies and exactly a 5% custom seed roll without wart',()=>{
 assert.deepEqual(table.pools[0].rolls,{min:4,max:7});
 const seeds=table.pools.find(p=>p.entries.some(e=>e.name.endsWith('_seeds')));
 assert.equal(seeds.rolls,1);assert.equal(seeds.conditions[0].chance,.05);
 assert.equal(seeds.entries.length,4);
 for(const entry of seeds.entries){
  const item=JSON.parse(readFileSync(new URL(`../.build/behavior_pack/items/${entry.name.split(':')[1]}.json`,import.meta.url)))['minecraft:item'];
  assert(item.components['minecraft:block_placer'],`${entry.name} must be plantable`);
 }
 assert.deepEqual(seeds.entries.map(e=>e.name),['jagsby_nether:rye_seeds','jagsby_nether:murky_seeds','jagsby_nether:scarberries','jagsby_nether:polyp']);
 for(const e of seeds.entries){assert.equal(e.weight,1);assert.deepEqual(e.functions[0].count,{min:1,max:3});}
 for(const pool of table.pools)for(const e of pool.entries){
  assert(!e.name.includes('nether_wart'));
  if(e.name.startsWith('jagsby_nether:'))assert(existsSync(new URL(`../.build/behavior_pack/items/${e.name.split(':')[1]}.json`,import.meta.url)));
 }
});

test('chest finds use Wither Bones and explicit independent rare/uncommon rolls',()=>{
 assert(table.pools[0].entries.some(e=>e.name==='jagsby_nether:wither_bone'));
 assert(!table.pools.flatMap(p=>p.entries).some(e=>e.name==='minecraft:bone'));
 const expected={'minecraft:netherite_scrap':.01,'minecraft:potion':.20,'minecraft:golden_apple':.03,'minecraft:gold_block':.03,'minecraft:diamond':.05};
 for(const [name,chance] of Object.entries(expected)){
  const pool=table.pools.find(p=>p.entries.length===1&&p.entries[0].name===name);assert(pool);assert.equal(pool.rolls,1);assert.equal(pool.conditions[0].chance,chance);
 }
 const potion=table.pools.flatMap(p=>p.entries).find(e=>e.name==='minecraft:potion');assert.deepEqual(potion.functions.at(-1),{function:'set_potion',id:'fire_resistance'});
 const diamond=table.pools.find(p=>p.entries[0].name==='minecraft:diamond');assert.deepEqual(diamond.entries[0].functions[0].count,{min:1,max:2});
});
test('ominous bottles use the native amplifier function for weighted tiers I through V',()=>{
 const pool=table.pools.find(p=>p.entries[0].name==='minecraft:ominous_bottle');assert.equal(pool.conditions[0].chance,.12);assert.equal(pool.rolls,1);
 assert.deepEqual(pool.entries.map(e=>e.weight),[40,30,18,9,3]);
 for(const [tier,entry] of pool.entries.entries()){
  assert.equal(entry.name,'minecraft:ominous_bottle');assert.deepEqual(entry.functions.at(-1),{function:'set_ominous_bottle_amplifier',amplifier:{min:tier,max:tier}});
 }
});
