import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system} from './mock-server.mjs';
import {ARENAS} from '../behavior_pack/scripts/arena_catalog.js';
import {arenaRequest,placeArena} from '../behavior_pack/scripts/arenas.js';
function fixture(){
 const calls=[],places=[];
 const dimension={heightRange:{min:0,max:128},getBlock(){return {typeId:'minecraft:air'};},runCommand(command){calls.push(command);}};
 const player={location:{x:0,y:32,z:0},dimension};
 return {dimension,player,calls,places};
}
function finish(job){for(let i=0;i<1000;i++){const s=job.next();if(s.done)return;system.currentTick++;}throw Error('Placement did not finish');}
test('arena list includes all seven manual templates; absolute coordinates and height are checked',()=>{
 assert.deepEqual(Object.keys(ARENAS),['small_arena','large_arena','dragon_arena','grave_yard','large_blackstone_pillars','large_blackstone_walls','mega_fortress']);
 const f=fixture();assert.deepEqual(arenaRequest('small_arena',f.player).origin,{x:8,y:31,z:8});
 assert.deepEqual(arenaRequest('dragon_arena 100 32 100',f.player).origin,{x:100,y:32,z:100});
 for(const name of Object.keys(ARENAS))assert.equal(ARENAS[name].spawn_enabled,false);
 for(const input of ['unknown','small_arena 1 2','small_arena 1.5 32 0','large_arena 0 100 0'])assert.throws(()=>arenaRequest(input,f.player));
});
test('manual placement uses exact section offsets and removes temporary ticking area',()=>{
 const f=fixture(),old=world.structureManager;world.structureManager={place(id,dim,pos,options){assert.equal(dim,f.dimension);f.places.push({id,pos});assert.equal(options.includeEntities,false);}};
 try{finish(placeArena(arenaRequest('dragon_arena 100 32 100',f.player)));}finally{world.structureManager=old;}
 assert.equal(f.places.length,6);
 ARENAS.dragon_arena.sections.forEach((s,i)=>assert.deepEqual(f.places[i],{id:s.id,pos:{x:100+s.offset[0],y:32+s.offset[1],z:100+s.offset[2]}}));
 assert(f.calls[0].startsWith('tickingarea add '));assert(f.calls.at(-1).startsWith('tickingarea remove '));
});
test('unloaded terrain and placement errors always clean up ticking areas',()=>{
 for(const failure of ['unloaded','place']){
  const f=fixture(),old=world.structureManager;
  if(failure==='unloaded')f.dimension.getBlock=()=>undefined;
  world.structureManager={place(){throw Error('placement unavailable');}};
  try{assert.throws(()=>finish(placeArena(arenaRequest('small_arena',f.player))));}finally{world.structureManager=old;}
  assert(f.calls.at(-1).startsWith('tickingarea remove '));
 }
});

test('Mega Fortress loads and cleans each section below the 100-chunk ticking-area limit',()=>{
 const f=fixture(),old=world.structureManager;world.structureManager={place(id,dim,pos){f.places.push({id,pos});}};
 try{finish(placeArena(arenaRequest('mega_fortress 100 32 100',f.player)));}finally{world.structureManager=old;}
 assert.equal(f.places.length,ARENAS.mega_fortress.sections.length);
 assert.equal(f.calls.length,f.places.length*2);
 for(let i=0;i<f.calls.length;i+=2){
  assert(f.calls[i].startsWith('tickingarea add '));assert(f.calls[i+1].startsWith('tickingarea remove '));
  const parts=f.calls[i].split(' '),x=Number(parts[2]),z=Number(parts[4]),endX=Number(parts[5]),endZ=Number(parts[7]);
  assert((Math.floor(endX/16)-Math.floor(x/16)+1)*(Math.floor(endZ/16)-Math.floor(z/16)+1)<=100);
 }
});
