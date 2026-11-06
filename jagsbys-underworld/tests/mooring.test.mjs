import test from 'node:test';
import assert from 'node:assert/strict';
import {world,flush,GameMode} from './mock-server.mjs';
import {enchantRod,hasMooring,updateResistance,ROD,BOOK,MARK,BASE} from '../behavior_pack/scripts/lava_fishing/mooring.js';
class Rod {
 constructor(){this.typeId=ROD;this.props=new Map();this.lore=['Original lore'];this.damage=72;this.enchants=['mending'];}
 getDynamicProperty(k){return this.props.get(k);}setDynamicProperty(k,v){this.props.set(k,v);}
 getLore(){return this.lore;}setLore(v){this.lore=v;}
 clone(){const r=new Rod();r.props=new Map(this.props);r.lore=[...this.lore];r.enchants=[...this.enchants];return r;}
}
function player(){
 const props=new Map(),slots={Mainhand:enchantRod(new Rod()),Offhand:{typeId:BOOK,amount:1}};
 const kb={currentValue:.4,effectiveMax:1,setCurrentValue(v){this.currentValue=v;}};
 const eq={getEquipment(k){return slots[k];},setEquipment(k,v){slots[k]=v;}};
 const p={id:Math.random()+'',typeId:'minecraft:player',isSneaking:true,selectedSlotIndex:0,
 getGameMode:()=>GameMode.Survival,getComponent(k){return k==='minecraft:equippable'?eq:kb;},
 getDynamicProperty(k){return props.get(k);},setDynamicProperty(k,v){props.set(k,v);},sendMessage(){}};
 return {p,kb,slots,props};
}
test('application preserves durability, native enchantments and lore; duplicate books are refused',()=>{
 const rod=new Rod(),result=enchantRod(rod);assert.ok(hasMooring(result));assert.equal(result.damage,72);
 assert.deepEqual(result.enchants,['mending']);assert.deepEqual(result.lore,['Original lore','§r§7Mooring I']);
 assert.equal(rod.getDynamicProperty(MARK),undefined);assert.equal(enchantRod(result),undefined);
});
test('full native resistance restores the previous armor/pack value on unequip',()=>{
 const {p,kb,slots,props}=player();assert.equal(updateResistance(p),true);assert.equal(kb.currentValue,1);
 assert.equal(props.get(BASE),.4);updateResistance(p);slots.Mainhand=undefined;updateResistance(p);
 assert.equal(kb.currentValue,.4);assert.equal(props.get(BASE),undefined);
});
test('saved baseline survives reload and cleanup does not overwrite a newer external value',()=>{
 const {p,kb,slots,props}=player();props.set(BASE,.2);kb.currentValue=1;slots.Mainhand=undefined;updateResistance(p);
 assert.equal(kb.currentValue,.2);slots.Mainhand=enchantRod(new Rod());updateResistance(p);
 kb.currentValue=.6;slots.Mainhand=undefined;updateResistance(p);assert.equal(kb.currentValue,.6);
});
test('unsupported native control produces an explicit failure rather than fake immunity',()=>{
 const {p,kb}=player();kb.effectiveMax=.8;assert.throws(()=>updateResistance(p),/unavailable/);
});
test('anvil consumes one book, preserves the rod, and ignores repeated interaction events',()=>{
 const {p,slots}=player();slots.Mainhand=new Rod();let sounds=0;
 const dim={id:'minecraft:nether',getBlock(){return {typeId:'minecraft:anvil'};},playSound(){sounds++;}};p.dimension=dim;
 const event={player:p,block:{typeId:'minecraft:anvil',dimension:dim,location:{x:0,y:64,z:0}},isFirstEvent:true};
 world.beforeEvents.playerInteractWithBlock.emit(event);assert.equal(event.cancel,true);flush();
 assert.ok(hasMooring(slots.Mainhand));assert.equal(slots.Offhand,undefined);assert.equal(sounds,1);
});
test('changing rod slot before deferred application consumes nothing',()=>{
 const {p,slots}=player();slots.Mainhand=new Rod();
 const dim={id:'minecraft:nether',getBlock(){return {typeId:'minecraft:anvil'};}};p.dimension=dim;
 world.beforeEvents.playerInteractWithBlock.emit({player:p,block:{typeId:'minecraft:anvil',dimension:dim,location:{}},isFirstEvent:true});
 p.selectedSlotIndex=1;flush();assert.equal(slots.Offhand.amount,1);assert.equal(hasMooring(slots.Mainhand),false);
});
