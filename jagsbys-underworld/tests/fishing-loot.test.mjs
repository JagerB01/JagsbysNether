import test from 'node:test';
import {ItemStack} from '@minecraft/server';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JUNK,TREASURE,categoryPool,selectWeighted,damageEquipment,createCatchReward} from '../behavior_pack/scripts/lava_fishing/loot.js';
test('unenhanced 10,000 catches and vanilla Luck quality weights',()=>{
 const counts={fish:0,junk:0,treasure:0};
 for(let i=0;i<10000;i++)counts[selectWeighted(categoryPool(),()=> (i+.5)/10000)]++;
 assert.deepEqual(counts,{fish:8500,junk:1000,treasure:500});
 for(let level=0;level<=3;level++)assert.deepEqual(categoryPool(level),[['fish',85-level],['junk',10-2*level],['treasure',5+2*level]]);
});
test('every junk and treasure entry has its exact relative frequency',()=>{
 for(const [pool,total,length] of [[JUNK,100,12],[TREASURE,110,8]]){
  assert.equal(pool.length,length);assert.equal(pool.reduce((n,[,w])=>n+w,0),total);
  const counts=new Map();for(let i=0;i<total;i++){const id=selectWeighted(pool,()=> (i+.5)/total);counts.set(id,(counts.get(id)??0)+1);}
  assert.deepEqual([...counts],pool);
 }
 assert.equal(JUNK[0][0],'jagsby_nether:wither_bone');
});
test('damage leaves 10–40 percent durability, randomized at both endpoints',()=>{
 for(const maxDurability of [32,91]){
  const durability={maxDurability,damage:0},item={typeId:'minecraft:golden_sword',getComponent:()=>durability};
  for(const rng of [()=>0,()=>.999999]){
   damageEquipment(item,rng);const remaining=maxDurability-durability.damage;
   assert(remaining/maxDurability>=.1);assert(remaining/maxDurability<=.4);
   assert.equal(remaining,rng()===0?Math.ceil(maxDurability*.1):Math.floor(maxDurability*.4));
  }
 }
});
test('one reward only, fish deferred until selected, native enchanted loot and no duplicates',()=>{
 let fishCalls=0,generated=0;
 const enchanted={typeId:'minecraft:enchanted_book',amount:1,getComponent:()=>({getEnchantments:()=>[{type:{id:'mending'},level:1}]})};
 const manager={getLootTable:path=>{assert.equal(path,'lava_fishing/treasure_book');return {};},generateLootFromTable:()=>{generated++;return [enchanted];}};
 const rolls=[.99,35/110];
 assert.equal(createCatchReward({rng:()=>rolls.shift(),fish:()=>{fishCalls++;return 'arowana_fish';},lootManager:manager}),enchanted);
 assert.equal(generated,1);assert.equal(fishCalls,0);
 const fish=createCatchReward({rng:()=>0,fish:()=>{fishCalls++;return 'arowana_fish';}});
 assert.equal(fish.amount,1);assert.equal(fish.typeId,'jagsby_nether:arowana_fish');assert.equal(fishCalls,1);
 for(const pool of [JUNK,TREASURE]){
  let offset=0;
  for(const [id,weight] of pool){
   const category=pool===JUNK?.9:.99,roll=(offset+weight/2)/pool.reduce((n,[,w])=>n+w,0);offset+=weight;
   if(['minecraft:golden_sword','minecraft:golden_boots','minecraft:enchanted_book'].includes(id))continue;
   const values=[category,roll];const reward=createCatchReward({rng:()=>values.shift(),fish:()=>{throw Error('Wrong category');}});
   assert.equal(reward.typeId,id);assert.equal(reward.amount,1);
  }
 }
});
test('native treasure tables request actual level-30 vanilla treasure enchantments',()=>{
 for(const [name,id] of [['book','minecraft:book'],['sword','minecraft:golden_sword']]){
  const data=JSON.parse(readFileSync(new URL(`../behavior_pack/loot_tables/lava_fishing/treasure_${name}.json`,import.meta.url)));
  assert.equal(data.pools.length,1);assert.equal(data.pools[0].rolls,1);
  assert.equal(data.pools[0].entries[0].name,id);
  assert.deepEqual(data.pools[0].entries[0].functions,[{function:'enchant_with_levels',treasure:true,levels:30}]);
 }
});

test('all damaged and enchanted rewards retain quantity one and actual enchantments',()=>{
 const original=ItemStack.prototype.getComponent;
 ItemStack.prototype.getComponent=function(type){
  if(type==='minecraft:durability')return this.durability??=( {maxDurability:32,damage:0});
  if(type==='minecraft:enchantable')return {getEnchantments:()=>this.enchantments??[]};
 };
 try{
  for(const [category,pool] of [[.9,JUNK],[.99,TREASURE]]){
   let offset=0;
   for(const [id,weight] of pool){
    const total=pool.reduce((n,[,w])=>n+w,0),roll=(offset+weight/2)/total;offset+=weight;
    const rolls=[category,roll,.5];
    const manager={getLootTable:()=>({}),generateLootFromTable:()=>{
     const stack=new ItemStack(id,1);stack.enchantments=[{type:{id:id==='minecraft:golden_sword'?'sharpness':'mending'},level:1}];return [stack];
    }};
    const reward=createCatchReward({rng:()=>rolls.shift(),lootManager:manager});
    assert.equal(reward.typeId,id);assert.equal(reward.amount,1);
    if(['minecraft:golden_sword','minecraft:golden_boots'].includes(id))assert(reward.durability.damage>0);
    const enchanted=category===.99 && ['minecraft:golden_sword','minecraft:enchanted_book'].includes(id);
    assert.equal((reward.enchantments?.length??0)>0,enchanted);
   }
  }
 }finally{ItemStack.prototype.getComponent=original;}
});
