export const FOOD_BUFF_DURATION_MS=20*60*1000;
export const FOOD_BUFF_TAG='jagsby_nether:food_buff:';
export const FOOD_BUFFS=Object.freeze({
 wickspit:{name:'Wickspit',skills:['martial','agility','slayer']},
 gloamquill:{name:'Gloamquill',skills:['ranged','agility','slayer']},
 cragbake:{name:'Cragbake',skills:['mining','woodcutting','excavation','smithing']},
 murkbrew:{name:'Murkbrew',skills:['farming','husbandry','fishing','cooking']},
 scarbisque:{name:'Scarbisque',skills:['enchanting','alchemy','trading']}
});
export function readFoodBuff(player,now=Date.now()){
 let current;
 for(const tag of player.getTags()){
  if(!tag.startsWith(FOOD_BUFF_TAG))continue;
  const [kind,time]=tag.slice(FOOD_BUFF_TAG.length).split(':');const expires=Number(time);
  if(!FOOD_BUFFS[kind]||!Number.isFinite(expires)||expires<=now)continue;
  if(!current||expires>current.expires)current={kind,expires};
 }
 return current;
}
export function activateFoodBuff(player,kind,now=Date.now()){
 if(!FOOD_BUFFS[kind])return undefined;
 for(const tag of player.getTags())if(tag.startsWith(FOOD_BUFF_TAG))player.removeTag(tag);
 const buff={kind,expires:now+FOOD_BUFF_DURATION_MS};
 if(!player.addTag(`${FOOD_BUFF_TAG}${kind}:${buff.expires}`))throw Error('Could not save food buff');
 return buff;
}
export function foodBuffMultiplier(buff,skill,now=Date.now()){
 return buff&&buff.expires>now&&FOOD_BUFFS[buff.kind]?.skills.includes(skill)?2:1;
}
export function clearExpiredFoodBuffs(player,now=Date.now()){
 for(const tag of player.getTags())if(tag.startsWith(FOOD_BUFF_TAG)){
  const [kind,time]=tag.slice(FOOD_BUFF_TAG.length).split(':');
  if(!FOOD_BUFFS[kind]||!Number.isFinite(Number(time))||Number(time)<=now)player.removeTag(tag);
 }
}
