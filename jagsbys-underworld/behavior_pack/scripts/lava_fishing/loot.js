// SPDX-License-Identifier: AGPL-3.0-only
import {ItemStack, world} from '@minecraft/server';
export const JUNK=[['jagsby_nether:wither_bone',12],['minecraft:gold_nugget',10],['minecraft:golden_sword',4],['minecraft:golden_boots',4],['minecraft:iron_nugget',10],['minecraft:fire_charge',7],['minecraft:magma_cream',8],['minecraft:redstone',10],['minecraft:quartz',10],['minecraft:cooked_porkchop',10],['minecraft:charcoal',9],['minecraft:experience_bottle',6]];
export const TREASURE=[['minecraft:blaze_powder',30],['minecraft:enchanted_book',24],['minecraft:golden_apple',18],['minecraft:crying_obsidian',16],['minecraft:golden_sword',12],['minecraft:wither_skeleton_skull',5],['minecraft:lodestone',4],['minecraft:netherite_scrap',1]];
export function categoryPool(luck=0){
 const level=Math.max(0,Math.min(3,Math.floor(luck)));
 // Vanilla quality modifiers: fish -1, junk -2, treasure +2 per Luck level.
 return [['fish',85-level],['junk',Math.max(0,10-2*level)],['treasure',5+2*level]];
}
export function selectWeighted(pool,rng=Math.random){
 let roll=rng()*pool.reduce((sum,[,weight])=>sum+weight,0);
 for(const [id,weight] of pool){roll-=weight;if(roll<0)return id;}
 return pool.at(-1)[0];
}
export function damageEquipment(item,rng=Math.random){
 const durability=item.getComponent('minecraft:durability');
 if(!durability)throw Error(`Missing durability on fishing reward ${item.typeId}`);
 const min=Math.max(1,Math.ceil(durability.maxDurability*0.1));
 const max=Math.floor(durability.maxDurability*0.4);
 const remaining=min+Math.floor(rng()*(max-min+1));
 durability.damage=durability.maxDurability-remaining;
 return item;
}
function enchantedReward(id,manager){
 const path=`lava_fishing/${id==='minecraft:enchanted_book'?'treasure_book':'treasure_sword'}`;
 const table=manager.getLootTable(path);
 if(!table)throw Error(`Missing fishing loot table ${path}`);
 const items=manager.generateLootFromTable(table);
 if(items?.length!==1 || items[0].amount!==1 || !items[0].getComponent('minecraft:enchantable')?.getEnchantments().length)
  throw Error(`Invalid enchanted fishing reward from ${path}`);
 return items[0];
}
export function createCatchReward({luck=0,fish,rng=Math.random,lootManager}={}){
 const category=selectWeighted(categoryPool(luck),rng);
 if(category==='fish')return new ItemStack(`jagsby_nether:${fish()}`,1);
 const id=selectWeighted(category==='junk'?JUNK:TREASURE,rng);
 const enchanted=category==='treasure' && ['minecraft:enchanted_book','minecraft:golden_sword'].includes(id);
 const item=enchanted?enchantedReward(id,lootManager??world.getLootTableManager()):new ItemStack(id,1);
 if(['minecraft:golden_sword','minecraft:golden_boots'].includes(id))damageEquipment(item,rng);
 return item;
}
