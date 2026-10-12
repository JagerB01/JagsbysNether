import {ActionFormData} from '@minecraft/server-ui';

const active = new Set();
const inventory = entity => entity.getComponent('minecraft:inventory')?.container;
const nearby = (player, pet) => player.dimension.id === pet.dimension.id && Math.hypot(player.location.x-pet.location.x,player.location.y-pet.location.y,player.location.z-pet.location.z)<=8;
const label = item => item.nameTag || item.typeId.split(':').pop().replaceAll('_', ' ');
const snapshot = item => item ? JSON.stringify([item.typeId,item.amount,item.nameTag ?? '',item.getComponent('minecraft:durability')?.damage, item.getComponent('minecraft:enchantable')?.getEnchantments().map(e=>[e.type.id,e.level]),item.getDynamicPropertyIds?.().map(k=>[k,item.getDynamicProperty(k)])]) : '';

// Recheck the selected stack immediately before transfer: stale forms must not
// move a replacement item after another player changes either inventory.
export function moveStack(source, slot, destination, expected) {
  const item = source.getItem(slot);
  if (!item || snapshot(item) !== expected) return false;
  const remainder = destination.addItem(item);
  source.setItem(slot, remainder);
  return true;
}
export const stackSnapshot = snapshot;

export async function openStorage(player, pet) {
  if (active.has(player.id)) return;
  active.add(player.id);
  let sounded = false;
  try {
    pet.triggerEvent('jagsby_nether:retain_storage');
    while (true) {
      if (!nearby(player,pet)) break;
      const chest = inventory(pet), bag = inventory(player);
      if (!chest || !bag) break;
      const form = new ActionFormData().title('Skitterchest').body('Select a stack to take it. Choose Store item to put something in.');
      const stacks = [];
      for (let slot=0;slot<chest.size;slot++) {
        const item=chest.getItem(slot);stacks.push(snapshot(item));
        form.button(item ? `${slot+1}. ${label(item)} ×${item.amount}` : `${slot+1}. Empty`);
      }
      form.button('Store item');form.button('Close');
      if (!sounded) {pet.dimension.playSound('jagsby_nether.skitterchest.open',pet.location);sounded=true;}
      const result=await form.show(player);
      if (!nearby(player,pet) || result.canceled || result.selection===chest.size+1) break;
      if (result.selection<chest.size) moveStack(chest,result.selection,bag,stacks[result.selection]);
      else {
        const deposit=new ActionFormData().title('Store item').body('Choose a stack from your inventory.');
        const choices=[];
        for(let slot=0;slot<bag.size;slot++) {
          const item=bag.getItem(slot);
          if(item){choices.push({slot,expected:snapshot(item)});deposit.button(`${label(item)} ×${item.amount}`);}
        }
        if(!choices.length) continue;
        deposit.button('Back');const picked=await deposit.show(player);
        if(nearby(player,pet) && !picked.canceled && choices[picked.selection]) {
          const {slot,expected}=choices[picked.selection];moveStack(bag,slot,chest,expected);
        }
      }
    }
  } catch(error) {console.warn(`[Underworld Skitterchest storage] ${error}`);}
  finally {
    active.delete(player.id);
    if(sounded) {try {pet.dimension.playSound('jagsby_nether.skitterchest.close',pet.location);}catch{}}
  }
}
