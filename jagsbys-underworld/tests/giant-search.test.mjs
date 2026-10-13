import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system} from './mock-server.mjs';
import {TerrainSurvey,terrainSurvey} from '../.build/behavior_pack/scripts/terrain_survey.js';
import {GiantSearch,giantSearch,giantSites,attemptKey,attemptCell} from '../.build/behavior_pack/scripts/giant_search.js';
import {candidateAt,spacingAllows} from '../.build/behavior_pack/scripts/landmark_sites.js';
import {naturalCandidates,generateLandmark} from '../.build/behavior_pack/scripts/landmarks.js';
import {terrainSurvey as villageTerrainSurvey} from '../.build/behavior_pack/scripts/terrain_survey.js';
import {accessibleSites} from '../.build/behavior_pack/scripts/settlements/accessible_search.js';
function storage(){const m=new Map();return {m,getDynamicProperty:k=>m.get(k),setDynamicProperty(k,v){if(v===undefined)m.delete(k);else m.set(k,v);},getDynamicPropertyIds:()=>[...m.keys()]};}
function finish(job){for(let i=0;i<50000;i++){const s=job.next();system.currentTick++;if(s.done)return s.value;}assert.fail('Job did not finish');}
test('shared ocean observations are persisted, bounded per column and do not reread stationary columns',()=>{
 const store=storage(),cache=new TerrainSurvey(store);let reads=0;
 const d={id:'minecraft:nether',getBlock({y}){reads++;return {typeId:y===31?'minecraft:lava':'minecraft:air'};}};
 cache.observeLoadedColumn(d,8,8);assert.equal(reads,2);cache.observeLoadedColumn(d,8,8);assert.equal(reads,2);
 cache.flush();const reload=new TerrainSurvey(store);const online=[{location:{x:0,z:0}}];assert.deepEqual(reload.nearby(online),[[8,8,31]]);
 reload.ocean(9,9,31);reload.flush();assert.deepEqual(new TerrainSurvey(store).nearby(online),[[9,9,31]]);
});
test('missing observations are not cached as dry or failed',()=>{
 const cache=new TerrainSurvey(storage());let reads=0;
 const d={id:'minecraft:nether',getBlock(){reads++;return undefined;}};
 cache.observeLoadedColumn(d,8,8);cache.observeLoadedColumn(d,8,8);assert.equal(reads,4);assert.equal(cache.probed.size,0);assert.equal(cache.dirty.size,0);
});
test('one rejected giant search cell does not reject its region or neighbouring sites',()=>{
 const store=storage(),search=new GiantSearch(store),region=candidateAt('giant',3,-2,99);
 const other={...region,x:region.x+128,z:region.z};search.reject(region,'Too little lava');assert(search.failed(region));assert(!search.failed(other));
 assert(new GiantSearch(store).failed(region));assert.equal(store.getDynamicProperty(region.key),undefined);assert.notEqual(attemptKey(region),attemptKey(other));
 const sites=giantSites(region,[[other.x,other.z,31]]);assert(sites.some(c=>c.observed&&c.x===other.x));assert(sites.length>100);
});
test('legacy region failures reopen under relaxed terrain rules, preserving the seeded type',()=>{
 const store=storage(),region=candidateAt('giant',7,7,123);store.setDynamicProperty(region.key,JSON.stringify({state:'rejected',reason:'No open lava surface'}));
 const search=new GiantSearch(store),other={...region,regionX:region.x,regionZ:region.z,x:region.x+128,z:region.z};
 assert(!search.failed(other));assert(!search.failed(region));assert(giantSites(region,[]).every(c=>c.id===region.id));
});
test('actual loaded village survey contributes lava observations for giant discovery',()=>{
 const x=1024008,z=1024008,dimension={id:'minecraft:nether',isChunkLoaded:p=>Math.floor(p.x/16)===Math.floor(x/16)&&Math.floor(p.z/16)===Math.floor(z/16),getBlock({x,y,z}){return {typeId:y<=4?'minecraft:netherrack':y<=31?'minecraft:lava':'minecraft:air',isAir:y>31,isLiquid:y>4&&y<=31,location:{x,y,z}};}};
 const online=[{dimension,location:{x,y:64,z}}];finish(accessibleSites(dimension,online,world,123,new Map(),0));
 assert(villageTerrainSurvey.nearby([{location:{x:x+400,z}}]).some(p=>p[0]===x&&p[1]===z));
});
test('a region generates at a discovered ocean after its initial location fails',()=>{
 const gx=710,gz=710;let seed=1,region;
 while((region=candidateAt('giant',gx,gz,seed)).id!=='large_arena')seed++;
 const dry={id:'minecraft:nether',runCommand(){},getBiome:()=>({id:'minecraft:hell'}),getBlock:({y})=>({typeId:y<=31?'minecraft:netherrack':'minecraft:air'}),containsBlock:()=>false};
 finish(generateLandmark(region,dry));assert(giantSearch.failed(region));assert.equal(world.getDynamicProperty(region.key),undefined);
 const x=region.x+(region.x-gx*1600<800?256:-256),z=region.z,places=[];
 const ocean={...dry,getBlock:({x:bx,y,z:bz})=>({typeId:y<=4?'minecraft:netherrack':y<=31?(Math.abs(bx-x)<150&&Math.abs(bz-z)<150?'minecraft:lava':'minecraft:netherrack'):'minecraft:air'}),fillBlocks(){}};
 terrainSurvey.observeLoadedColumn(ocean,x,z);terrainSurvey.flush();
 const online=[{dimension:ocean,location:{x:x+400,y:64,z}}],c=naturalCandidates(online,seed)[0];assert.equal(c.key,region.key);assert.equal(c.x,x);assert.equal(c.id,region.id);assert(c.observed);
 const old=world.structureManager;world.structureManager={place:id=>places.push(id)};
 try{finish(generateLandmark(c,ocean));const record=JSON.parse(world.getDynamicProperty(region.key));assert.equal(record.state,'built');assert.equal(record.x,x);assert(places.length>0);assert(!naturalCandidates(online,seed).some(c=>c.key===region.key));}
 finally{world.structureManager=old;world.setDynamicProperty(region.key,undefined);}
});
test('relocated sites retain distance limits and spacing checks',()=>{
 const region=candidateAt('giant',800,800,23),point={...region,x:region.gx*1600+800,z:region.gz*1600+800};terrainSurvey.ocean(point.x,point.z,31);terrainSurvey.flush();
 const online=[{dimension:{id:'minecraft:nether'},location:{x:point.x+400,y:64,z:point.z}}];
 const sites=naturalCandidates(online,23);for(const c of sites)assert(c.distance<=768);assert(sites.some(c=>c.key===point.key&&c.x===point.x));
 assert(!spacingAllows(point,{x:point.x-31,z:point.z-49,sx:62,sz:99},[{key:'different',id:'large_arena',x:point.x+1499,z:point.z,box:{x:point.x+1468,z:point.z,sx:62,sz:99}}],[]));
});
test('deferred giant survey does not permanently reject its search cell',()=>{
 const c=candidateAt('giant',900,900,123),d={id:'minecraft:nether',runCommand(){},getBlock:()=>undefined};finish(generateLandmark(c,d));assert(!giantSearch.failed(c));assert.equal(world.getDynamicProperty(c.key),undefined);
});
