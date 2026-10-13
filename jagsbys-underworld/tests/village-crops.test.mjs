import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {flush} from './mock-server.mjs';
import {worldFixture} from './fixtures.mjs';
import {cropSites} from '../.build/behavior_pack/scripts/settlements/crop_sites.js';
import {plantStructureCrops,villageCrop} from '../.build/behavior_pack/scripts/settlements/village_crops.js';
import {rotate} from '../.build/behavior_pack/scripts/settlements/terrain.js';
import {catalog} from '../.build/behavior_pack/scripts/settlements/catalog.js';

function finish(job){let step;do{step=job.next();flush();}while(!step.done);return step.value;}
function fixture(values){const {dimension,put}=worldFixture();let spawned=0,removed=0;
 dimension.spawnEntity=(type,position)=>{
  assert.equal(type,'jagsby_nether:crop_biome_probe');let classified=false;
  const value=values[spawned++%values.length];
  return {triggerEvent(event){assert.equal(event,'jagsby_nether:classify');classified=true;},getProperty(name){assert(classified);assert.equal(name,'jagsby_nether:village_crop');return value;},remove(){removed++;}};
 };
 return {dimension,put,counts:()=>({spawned,removed})};
}
const piece=Object.values(catalog).find(piece=>(cropSites[piece.id]?.length ?? 0)>=2);
const id=piece?.id;
assert(piece,'A real village structure with planting positions is required');
const origin={x:100,z:200},baseY=64;
function position(site,rotation){const [x,z]=rotate(site[0],site[2],piece.size,rotation);return {x:origin.x+x,y:baseY+site[1],z:origin.z+z};}
test('native filters map crimson/wastes to Sorgum, warped/soul valleys to Polyps',()=>{
 const entity=JSON.parse(readFileSync(new URL('../behavior_pack/entities/crop_biome_probe.json',import.meta.url)))['minecraft:entity'];
 const mappings=entity.events['jagsby_nether:classify'].sequence.map(e=>[e.filters.any_of.map(f=>{assert.equal(f.test,'has_biome_tag');return f.value;}),e.set_property['jagsby_nether:village_crop']]);
 assert.deepEqual(mappings,[[['crimson_forest','nether_wastes'],1],[['warped_forest','soulsand_valley'],2]]);
 assert.equal(entity.description.properties['jagsby_nether:village_crop'].default,0);
});
test('native classification waits for property updates and cleans up, including failures',()=>{
 for(const [value,expected] of [[0,undefined],[1,'sorgum'],[2,'polyps']]){
  const f=fixture([value]),job=villageCrop(f.dimension,{x:0,y:65,z:0});
  assert.equal(job.next().done,false);flush();assert.deepEqual(job.next(),{value:expected,done:true});assert.deepEqual(f.counts(),{spawned:1,removed:1});
 }
 const f=fixture([undefined]);assert.throws(()=>finish(villageCrop(f.dimension,origin)),/classification failed/);assert.equal(f.counts().removed,1);
});
test('real planting coordinates rotate correctly and each spot uses its own biome',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const f=fixture([1,2,0]);
  for(const site of cropSites[id]){const p=position(site,rotation);f.put('minecraft:soul_sand',{...p,y:p.y-1});f.put('minecraft:air',p);}
  finish(plantStructureCrops(f.dimension,piece,rotation,origin,baseY,true));
  cropSites[id].forEach((site,i)=>{
   const p=position(site,rotation),crop=i%3;
   assert.equal(f.dimension.getBlock(p).typeId,['jagsby_nether:rye_crop','jagsby_nether:polyps','minecraft:air'][crop]);
   assert.equal(f.dimension.getBlock({...p,y:p.y-1}).typeId,crop===2?'minecraft:soul_sand':'jagsby_nether:soul_soil_farmland');
  });
  assert.deepEqual(f.counts(),{spawned:cropSites[id].length,removed:cropSites[id].length});
 }
});
test('standalone structures never receive crops or biome probes',()=>{
 const f=fixture([1]);finish(plantStructureCrops(f.dimension,piece,0,origin,baseY,false));assert.deepEqual(f.counts(),{spawned:0,removed:0});
});
test('direct biome queries select village crops without probes',()=>{
 for(const [id,expected] of [['minecraft:hell','sorgum'],['minecraft:crimson_forest','sorgum'],['minecraft:warped_forest','polyps'],['minecraft:soulsand_valley','polyps'],['minecraft:basalt_deltas',undefined]]){
  const f=fixture([]);f.dimension.getBiome=()=>({id});assert.equal(finish(villageCrop(f.dimension,origin)),expected);assert.equal(f.counts().spawned,0);
 }
});
