import test from 'node:test';
import assert from 'node:assert/strict';
import {world,ItemStack} from './mock-server.mjs';
import {tryFeedDroppedCrop} from '../behavior_pack/scripts/villager_crop_food.js';
let serial=0;
function fixture(){
 const villagers=[],drops=[];
 const dimension={getEntities({type}){return villagers.filter(v=>v.typeId===type);},spawnItem(stack,location){return drop(stack.typeId,stack.amount,location,stack);}};
 function villager({baby=false,typeId='minecraft:villager_v2',x=0.5,full=false}={}){
  const slots=Array(8),data=new Map();if(full)slots.fill(new ItemStack('minecraft:wheat_seeds',64));
  const v={id:`crop-villager-${serial++}`,typeId,dimension,location:{x,y:64,z:0},isValid:true,
   hasComponent(id){return id==='minecraft:is_baby'&&baby;},getComponent(){return {container:bag};},
   getDynamicProperty:k=>data.get(k),setDynamicProperty(k,value){data.set(k,value);}};
  const bag={size:8,getItem:i=>slots[i],setItem(i,item){slots[i]=item;}};
  villagers.push(v);return {v,bag,slots,data};
 }
 function drop(typeId='jagsby_nether:rye',amount=12,location={x:0,y:64,z:0},stack=new ItemStack(typeId,amount)){
  const e={id:`crop-drop-${serial++}`,typeId:'minecraft:item',dimension,location,isValid:true,
   getComponent(){return {itemStack:stack};},remove(){this.isValid=false;}};drops.push(e);return e;
 }
 return {villager,drop,drops,villagers};
}
for(const item of ['jagsby_nether:rye','jagsby_nether:polyp'])test(`12 ${item} give an adult the native 12-point breeding-food requirement`,()=>{
 const f=fixture(),v=f.villager(),drop=f.drop(item);
 assert.equal(tryFeedDroppedCrop(drop),12);assert.equal(drop.isValid,false);
 assert.equal(v.slots[0].typeId,'minecraft:bread');assert.equal(v.slots[0].amount,3);
});
test('partial and mixed crop servings accumulate without granting excess food',()=>{
 const f=fixture(),v=f.villager();
 assert.equal(tryFeedDroppedCrop(f.drop('jagsby_nether:rye',3)),3);assert.equal(v.slots[0],undefined);
 assert.equal(tryFeedDroppedCrop(f.drop('jagsby_nether:polyp',9)),9);
 assert.equal(v.slots[0].amount,3);assert.equal(v.data.get('jagsby_nether:crop_food_credit'),0);
});
test('a 24-crop stack can feed two villagers, preserving the remaining dropped stack',()=>{
 const f=fixture(),a=f.villager(),b=f.villager({x:1});
 const stack=new ItemStack('jagsby_nether:rye',24);stack.customName='Garden harvest';
 assert.equal(tryFeedDroppedCrop(f.drop(stack.typeId,24,undefined,stack)),12);
 const remainder=f.drops.find(d=>d.isValid);assert.equal(remainder.getComponent().itemStack.amount,12);
 assert.equal(remainder.getComponent().itemStack.customName,'Garden harvest');
 assert.equal(tryFeedDroppedCrop(remainder),12);assert.equal(a.slots[0].amount,3);assert.equal(b.slots[0].amount,3);
});
test('baby villagers, unrelated merchants and distant villagers receive no crop food',()=>{
 for(const config of [{baby:true},{typeId:'concom:villager_haggle'},{x:1.501}]){
  const f=fixture(),v=f.villager(config),drop=f.drop();assert.equal(tryFeedDroppedCrop(drop),0);assert.equal(drop.isValid,true);assert.equal(v.slots[0],undefined);
 }
});
test('mobGriefing=false prevents pickup, like vanilla villager feeding',()=>{
 const f=fixture(),v=f.villager(),drop=f.drop();world.gameRules.mobGriefing=false;
 try{assert.equal(tryFeedDroppedCrop(drop),0);assert.equal(drop.isValid,true);assert.equal(v.slots[0],undefined);}
 finally{world.gameRules.mobGriefing=true;}
});
test('seeds, emeralds, harmful crop variants and vanilla foods are left to their native handlers',()=>{
 const f=fixture();f.villager();
 for(const id of ['jagsby_nether:rye_seeds','jagsby_nether:wither_polyp','jagsby_nether:blistered_rye','minecraft:emerald','minecraft:bread']){
  const drop=f.drop(id);assert.equal(tryFeedDroppedCrop(drop),0);assert.equal(drop.isValid,true);
 }
});
test('full inventories and already-fed villagers leave the crops in the world',()=>{
 const f=fixture();f.villager({full:true});const fed=f.villager({x:1});fed.bag.setItem(0,new ItemStack('minecraft:bread',3));
 const drop=f.drop();assert.equal(tryFeedDroppedCrop(drop),0);assert.equal(drop.isValid,true);
});
test('existing native food is respected rather than overwritten',()=>{
 const f=fixture(),v=f.villager();v.bag.setItem(0,new ItemStack('minecraft:bread',2));v.bag.setItem(1,new ItemStack('minecraft:emerald',7));
 assert.equal(tryFeedDroppedCrop(f.drop()),4);assert.equal(v.slots[0].amount,3);assert.equal(v.slots[1].amount,7);
 assert.equal(f.drops.find(d=>d.isValid).getComponent().itemStack.amount,8);
});
test('failed native inventory writes restore crops without granting food',()=>{
 const f=fixture(),v=f.villager(),drop=f.drop('jagsby_nether:rye',24);
 v.bag.setItem=()=>{throw Error('Inventory unavailable');};
 assert.throws(()=>tryFeedDroppedCrop(drop),/Inventory unavailable/);
 assert.equal(v.slots[0],undefined);
 assert.equal(f.drops.filter(d=>d.isValid).reduce((n,d)=>n+d.getComponent().itemStack.amount,0),24);
});
