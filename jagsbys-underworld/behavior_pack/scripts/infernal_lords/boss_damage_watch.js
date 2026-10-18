// Actual-health measurements are opt-in. No hurt listeners exist without watchers.
import {world,system} from '@minecraft/server';
const watching=new Set(),pending=new Map();
let listening=false;
const names={'dungeons:nameless_one':'Malzareth','dungeons:wretched_wraith':'Nerezhal','dungeons:boss_wildfire':'Baelgor',
 'dungeons:nameless_one_projectile':'Malzareth bolt','dungeons:wretched_wraith_projectile':'Nerezhal bolt','dungeons:boss_wildfire_fireball':'Baelgor fireball'};
function beforeHurt(event){
 const p=event.hurtEntity;if(!watching.has(p.id))return;pending.delete(p.id);
 let source;
 try{source=names[event.damageSource.damagingProjectile?.typeId]??names[event.damageSource.damagingEntity?.typeId];}catch{}
 if(!source)return;
 const hp=p.getComponent('minecraft:health')?.currentValue;
 if(Number.isFinite(hp))pending.set(p.id,{hp,source,tick:system.currentTick});
}
function afterHurt({hurtEntity:p,damage}){
 const before=pending.get(p.id);if(!before||before.tick!==system.currentTick)return;pending.delete(p.id);
 const hp=p.getComponent('minecraft:health')?.currentValue;
 if(Number.isFinite(hp))p.sendMessage(`[Underworld damage] ${before.source}: ${Math.max(0,before.hp-hp).toFixed(2)} HP lost (${(Math.max(0,before.hp-hp)/2).toFixed(2)} hearts); hurt event ${damage.toFixed(2)} HP.`);
}
function syncListeners(){
 const needed=watching.size>0;if(needed===listening)return;
 if(needed){world.beforeEvents.entityHurt.subscribe(beforeHurt);world.afterEvents.entityHurt.subscribe(afterHurt);}
 else {world.beforeEvents.entityHurt.unsubscribe(beforeHurt);world.afterEvents.entityHurt.unsubscribe(afterHurt);pending.clear();}
 listening=needed;
}
system.afterEvents.scriptEventReceive.subscribe(({id,message,sourceEntity:p})=>{
 if(id!=='jagsby_nether:boss_damage_watch'||p?.typeId!=='minecraft:player')return;
 const mode=(message??'').trim().toLowerCase();
 if(mode==='off'){watching.delete(p.id);pending.delete(p.id);syncListeners();p.sendMessage('[Underworld damage] Measurement off.');return;}
 if(!mode||mode==='status'){p.sendMessage(`[Underworld damage] Measurement ${watching.has(p.id)?'on':'off'}.`);return;}
 if(mode!=='on'){p.sendMessage('Use /scriptevent jagsby_nether:boss_damage_watch on | off | status');return;}
 watching.add(p.id);syncListeners();p.sendMessage(`[Underworld damage] Measurement on (${world.getDifficulty()}). Reports actual HP lost to boss hits; 2 HP = 1 heart. Use boss_damage_watch off to stop.`);
});
world.afterEvents.playerLeave.subscribe(({playerId})=>{watching.delete(playerId);pending.delete(playerId);syncListeners();});
