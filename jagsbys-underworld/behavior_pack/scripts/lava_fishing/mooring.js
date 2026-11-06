import {world,system,GameMode} from '@minecraft/server';
export const ROD='jagsby_nether:obsidian_fishing_rod', BOOK='jagsby_nether:mooring_book';
export const MARK='jagsby_nether:mooring', BASE='jagsby_nether:mooring_kb_base';
const active=new Map(), warned=new Set();
let pending=false;
export function hasMooring(item){return item?.typeId===ROD&&item.getDynamicProperty(MARK)===1;}
export function enchantRod(rod){
 if(rod?.typeId!==ROD||hasMooring(rod))return undefined;
 const result=rod.clone();result.setDynamicProperty(MARK,1);
 const lore=result.getLore();if(!lore.includes('§r§7Mooring I'))result.setLore([...lore,'§r§7Mooring I']);
 return result;
}
export function updateResistance(player){
 const held=player.getComponent('minecraft:equippable')?.getEquipment('Mainhand');
 const enabled=hasMooring(held)&&player.getGameMode()!==GameMode.Spectator;
 const saved=player.getDynamicProperty(BASE);
 if(!enabled&&saved===undefined){active.delete(player.id);return false;}
 const kb=player.getComponent('minecraft:knockback_resistance');
 if(!kb||typeof kb.setCurrentValue!=='function'||kb.effectiveMax<1)throw Error('Native player knockback resistance is unavailable');
 if(enabled){
  if(saved===undefined)player.setDynamicProperty(BASE,kb.currentValue);
  if(kb.currentValue!==1)kb.setCurrentValue(1);
  if(kb.currentValue<1)throw Error('Native knockback resistance did not accept full resistance');
  active.set(player.id,player);return true;
 }
 // Do not overwrite a newer value another pack has installed after ours.
 if(kb.currentValue===1)kb.setCurrentValue(Math.min(kb.effectiveMax,saved));
 player.setDynamicProperty(BASE,undefined);active.delete(player.id);return false;
}
function refresh(player){
 try{updateResistance(player);}catch(error){
  active.delete(player.id);
  if(!warned.has(player.id)){warned.add(player.id);console.warn(`[Underworld Mooring] ${error}`);player.sendMessage('§cMooring: native knockback resistance could not be enabled.');}
 }
 schedule();
}
function schedule(){
 if(pending||!active.size)return;pending=true;
 system.runTimeout(()=>{pending=false;for(const p of [...active.values()])refresh(p);},1);
}
world.afterEvents.playerSpawn.subscribe(({player})=>refresh(player));
world.afterEvents.playerHotbarSelectedSlotChange.subscribe(({player})=>refresh(player));
world.afterEvents.playerInventoryItemChange.subscribe(({player})=>refresh(player));
world.afterEvents.playerLeave.subscribe(({playerId})=>{active.delete(playerId);warned.delete(playerId);});
system.run(()=>{for(const p of world.getAllPlayers())refresh(p);});
world.beforeEvents.playerInteractWithBlock.subscribe(event=>{
 const {player,block}=event;
 if(!player.isSneaking||!['minecraft:anvil','minecraft:chipped_anvil','minecraft:damaged_anvil'].includes(block.typeId))return;
 const equipment=player.getComponent('minecraft:equippable');
 if(equipment?.getEquipment('Mainhand')?.typeId!==ROD||equipment.getEquipment('Offhand')?.typeId!==BOOK)return;
 event.cancel=true;if(!event.isFirstEvent)return;
 const slot=player.selectedSlotIndex,dimension=block.dimension,location={...block.location};
 system.run(()=>{
  try{
   if(player.selectedSlotIndex!==slot||player.dimension.id!==dimension.id||!player.isSneaking)return;
   if(!['minecraft:anvil','minecraft:chipped_anvil','minecraft:damaged_anvil'].includes(dimension.getBlock(location)?.typeId))return;
   const mode=player.getGameMode();if(mode!==GameMode.Survival&&mode!==GameMode.Creative)return;
   const eq=player.getComponent('minecraft:equippable'),rod=eq.getEquipment('Mainhand'),book=eq.getEquipment('Offhand');
   if(book?.typeId!==BOOK)return;
   const result=enchantRod(rod);if(!result){player.sendMessage('§7This rod already has Mooring I.');return;}
   eq.setEquipment('Mainhand',result);
   if(mode===GameMode.Survival){if(book.amount===1)eq.setEquipment('Offhand',undefined);else{book.amount--;eq.setEquipment('Offhand',book);}}
   dimension.playSound('random.anvil_use',location);player.sendMessage('§aApplied Mooring I.');refresh(player);
  }catch(error){console.warn(`[Underworld Mooring anvil] ${error}`);}
 });
});
system.afterEvents.scriptEventReceive.subscribe(({id,sourceEntity:p})=>{
 if(id!=='jagsby_nether:mooring_status'||p?.typeId!=='minecraft:player')return;
 try{const kb=p.getComponent('minecraft:knockback_resistance');p.sendMessage(`Mooring: held=${hasMooring(p.getComponent('minecraft:equippable')?.getEquipment('Mainhand'))}, native=${kb?.currentValue??'unavailable'}, max=${kb?.effectiveMax??'unavailable'}`);}catch(error){p.sendMessage(`Mooring: ${error}`);}
});
