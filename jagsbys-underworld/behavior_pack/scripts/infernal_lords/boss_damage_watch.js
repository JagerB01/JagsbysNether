// Opt-in measurements of actual player health loss. No polling or gear edits.
import {world,system} from '@minecraft/server';
const watching=new Set(),pending=new Map();
const names={'dungeons:nameless_one':'Malzareth','dungeons:wretched_wraith':'Nerezhal','dungeons:boss_wildfire':'Baelgor',
 'dungeons:nameless_one_projectile':'Malzareth bolt','dungeons:wretched_wraith_projectile':'Nerezhal bolt','dungeons:boss_wildfire_fireball':'Baelgor fireball'};
system.afterEvents.scriptEventReceive.subscribe(({id,message,sourceEntity:p})=>{
 if(id!=='jagsby_nether:boss_damage_watch'||p?.typeId!=='minecraft:player')return;
 if(message.trim()==='off'){watching.delete(p.id);pending.delete(p.id);p.sendMessage('[Underworld damage] Measurement off.');return;}
 watching.add(p.id);p.sendMessage(`[Underworld damage] Measurement on (${world.getDifficulty()}). Reports actual HP lost to boss hits; 2 HP = 1 heart. Use boss_damage_watch off to stop.`);
});
world.beforeEvents.entityHurt.subscribe(event=>{
 const p=event.hurtEntity;if(!watching.has(p.id))return;pending.delete(p.id);
 let source;
 try{source=names[event.damageSource.damagingProjectile?.typeId]??names[event.damageSource.damagingEntity?.typeId];}catch{}
 if(!source)return;
 const hp=p.getComponent('minecraft:health')?.currentValue;
 if(Number.isFinite(hp))pending.set(p.id,{hp,source,incoming:event.damage,tick:system.currentTick});
});
world.afterEvents.entityHurt.subscribe(({hurtEntity:p,damage})=>{
 const before=pending.get(p.id);if(!before||before.tick!==system.currentTick)return;pending.delete(p.id);
 const hp=p.getComponent('minecraft:health')?.currentValue;
 if(Number.isFinite(hp))p.sendMessage(`[Underworld damage] ${before.source}: ${Math.max(0,before.hp-hp).toFixed(2)} HP lost (${(Math.max(0,before.hp-hp)/2).toFixed(2)} hearts); hurt event ${damage.toFixed(2)} HP.`);
});
world.afterEvents.playerLeave.subscribe(({playerId})=>{watching.delete(playerId);pending.delete(playerId);});
