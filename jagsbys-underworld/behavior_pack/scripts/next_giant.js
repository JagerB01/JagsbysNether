import {world} from '@minecraft/server';
const KEY='underworld_landmarks:next_giant';
const IDS=['mega_fortress','dragon_arena','large_arena'];
let serial=0;
export function nextGiant(storage=world){
 try{const value=JSON.parse(storage.getDynamicProperty(KEY)??'null');return IDS.includes(value?.id)?value:undefined;}catch{return undefined;}
}
export function consumeNextGiant(selection,storage=world){
 if(!selection||nextGiant(storage)?.token!==selection.token)return false;
 storage.setDynamicProperty(KEY,undefined);return true;
}
export function nextGiantCommand(message,storage=world){
 const id=(message??'').trim().toLowerCase();
 if(id==='clear'){storage.setDynamicProperty(KEY,undefined);return 'Next giant override cleared. Equal random selection restored.';}
 if(!id||id==='status')return `Next giant: ${nextGiant(storage)?.id??'equal random selection'}.`;
 if(!IDS.includes(id))return 'Use /scriptevent jagsby_nether:next_giant mega_fortress | dragon_arena | large_arena | clear | status';
 storage.setDynamicProperty(KEY,JSON.stringify({id,token:`${Date.now()}:${++serial}`}));
 return `Next new natural giant: ${id}. Normal terrain, spacing and loading checks still apply. Failed surveys retain this choice; existing builds are unchanged.`;
}
