import {teleportDestination,landingAt,solidFloor,readBlock} from './teleport.js';
import { EntityDamageCause } from "@minecraft/server";
import { world,recordBossAction } from "./runtime.js";
import { scopedSystem } from "./runtime.js";
const system = scopedSystem("actors");


const teleportHiddenTime = 10
import { isValidTarget, getDirection, makeVector } from "./helpers.js"



// Native on_hit applies impact damage and removes the projectile. This also
// works with Fire Resistance and without a live owner in an after-hit event.
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (projectile.typeId !== "dungeons:wretched_wraith_projectile") return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;

    if (projectile.hasTag("dungeons:chud_projectile")) e.damage*=.75;
    if (hurt.matches({ families: ["undead"] }) || hurt.matches({ families: ["monster"] })) {
        e.cancel = true;
        e.damage = 0
    }
    if (projectile.hasTag("dungeons:chud_projectile")) {
        system.run(() => {
            if (hurt.isValid) hurt.applyKnockback({ x: 0, z: 0 }, -0.5)
        })
    }

});

//teleport
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if ((id === 'minecraft:entity_transformed' || id == "minecraft:entity_spawned") && entity.typeId == "dungeons:wretched_wraith") {
        entity.setDynamicProperty("dungeons:home", entity.location);
    }
});

function teleport(entity, loc, originLoc) {
    if (!entity?.isValid) return;
    if (loc == undefined) loc = entity.location;
    if (originLoc == undefined) originLoc = false
    const entityLoc = entity.location;
    const dim = entity.dimension;
    const home = entity.getDynamicProperty("dungeons:home") ?? entityLoc;
    entity.setDynamicProperty("dungeons:home", home);
    const teleportLoc = originLoc
        ? landingAt(dim,home.x,home.z,home.y,{height:4})
        : teleportDestination(entity,loc);
    if (!teleportLoc || !entity.tryTeleport(teleportLoc, {checkForBlocks:true})) return;
    recordBossAction(entity,'teleport_success');
    dim.playSound("mob.wraith.teleport", entityLoc, { pitch: 0.6 })
    dim.playSound("mob.wretched_wraith.bullethell", entityLoc, { pitch: 1 })
    dim.spawnParticle("dungeons:teleport_out", entityLoc)
    system.runTimeout(() => {
        if (entity.isValid && dim.isChunkLoaded(teleportLoc)) {
            dim.playSound("mob.wraith.teleport", entityLoc, { pitch: 0.9 })
            dim.spawnParticle("dungeons:teleport_in", teleportLoc)
        }
    }, teleportHiddenTime)
    entity.addEffect("invisibility", teleportHiddenTime, { showParticles: false })
    connectLine(entity, entityLoc, dim)
}
function connectLine(player, baseLoc, baseDim) {
    const baseDist = Math.hypot(baseLoc.x - player.location.x, baseLoc.y - player.location.y, baseLoc.z - player.location.z)
    for (let i = 1; i < teleportHiddenTime; i += teleportHiddenTime / baseDist) {
        system.runTimeout(() => {
            if (!player.isValid || player.dimension.id !== baseDim.id) return;
            const targetLoc = player.location;
            const xDif = targetLoc.x - baseLoc.x
            const yDif = targetLoc.y - baseLoc.y
            const zDif = targetLoc.z - baseLoc.z
            const particleLoc = { x: baseLoc.x + (xDif * (i / teleportHiddenTime)), y: 1 + baseLoc.y + (yDif * (i / teleportHiddenTime)), z: baseLoc.z + (zDif * (i / teleportHiddenTime)) }
            if (player.dimension.isChunkLoaded(particleLoc)) {
                player.dimension.spawnParticle("dungeons:teleport_beam", particleLoc)
            }
        }, i)
    }
}
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if (id === 'dungeons:wretched_wraith_teleport' && entity.typeId == "dungeons:wretched_wraith") {
        teleport(entity)
    }
});

//melee_attack
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if (id === 'dungeons:melee_attack' && entity.typeId == "dungeons:wretched_wraith") {
        entity.playAnimation("animation.wretched_wraith_v2.melee_attack")
        system.runTimeout(() => {
            if (!entity.isValid) return;
            const dim = entity.dimension;
            const loc = entity.location
            dim.spawnParticle("dungeons:wraith_ice_burst", loc)
            const damageRange = dim.getEntities({
                location: loc,
                maxDistance: 4,
                excludeFamilies: ['ignore']
            });
            for (const target of damageRange) {
                var damage = false
                if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                    if (target.matches({ families: ["monster"] })) continue;
                    damage = target.applyDamage(10, { cause: EntityDamageCause.entityAttack });
                    if (damage) {
                        if (target.typeId == "minecraft:player") {
                            target.runCommand("camerashake add @s 0.1 1.67")
                            target.runCommand("camerashake add @s 0.1 1.33")
                            target.runCommand("camerashake add @s 0.1 1")
                        }
                        const dir = getDirection(loc, target.location);
                        target.applyKnockback(makeVector(dir, 1), 0.3)
                        target.addEffect("slowness", 100, { amplifier: 1 })
                    }
                }
            }
        }, 15)
        system.runTimeout(() => {
            teleport(entity)
        }, 25)
    }
});

//bullethell

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if ((id === 'dungeons:begin_bullethell_center') && entity.typeId == "dungeons:wretched_wraith") {
        teleport(entity, entity.location, true)
        // The JSON windup timer starts the phase. A failed home teleport does
        // not prevent the phase from progressing at the current safe position.

    }
});

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if ((id === 'dungeons:bullethell_update') && entity.typeId == "dungeons:wretched_wraith") {
        const nearestPlayer = entity.dimension.getPlayers({ closest: 1, location: entity.location, maxDistance: 64, excludeGameModes: ["Spectator"] })
        if (nearestPlayer.length > 0) entity.lookAt(nearestPlayer[0].location)
    }
});
function multiply(a, b) {
    return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}
function shoot(entity, amount) {
    const nearestPlayer = entity.dimension.getPlayers({ closest: 1, location: entity.location, maxDistance: 64, excludeGameModes: ["Spectator"] })
    if (nearestPlayer.length > 0) entity.lookAt(nearestPlayer[0].location)
    const dim = entity.dimension;
    const viewDir = entity.getViewDirection()
    for (let i = 0; i < amount; i++) {
        var angle = -((amount - 1) / 2 * 10) + 10 * i;
        angle = angle * 2.15
        const radians = angle * (Math.PI / 180)
        //if (angle == 0) continue;
        const hd = entity.getHeadLocation();
        const vd = entity.getViewDirection();
        const projectile = dim.spawnEntity("dungeons:wretched_wraith_projectile", { x: hd.x + vd.x, y: hd.y + vd.y - 1.4, z: vd.z + hd.z })
        const comp = projectile.getComponent('projectile');
        let cosTheta = Math.cos(radians);
        let sinTheta = Math.sin(radians);
        const direction = {
            x: viewDir.x * cosTheta + viewDir.z * sinTheta,
            y: 0,
            z: -viewDir.x * sinTheta + viewDir.z * cosTheta
        }
        if (comp) {
            comp.owner = entity
            comp.shoot(multiply(direction, { x: 0.38, y: 1, z: 0.38 }))
        } else {
            projectile.applyImpulse(multiply(direction, { x: 0.38, y: 1, z: 0.38 }))
        }
        projectile.addTag("dungeons:chud_projectile")
        system.runTimeout(() => {
            if (projectile.isValid) projectile.remove()
        }, 100)
    }
}
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if ((id === 'dungeons:bullethell_projectile') && entity.typeId == "dungeons:wretched_wraith") {
        if (entity.isValid && entity.getProperty("dungeons:bullethell") == true) shoot(entity, 9)
        system.runTimeout(() => {
            if (entity.isValid && entity.getProperty("dungeons:bullethell") == true) shoot(entity, 10)
        }, 18)

    }
});


world.afterEvents.dataDrivenEntityTrigger.subscribe(({entity,eventId})=>{
    if(entity.typeId!=="dungeons:wretched_wraith"||eventId!=="dungeons:bullethell_start"||!entity.isValid)return;
    const active=()=>entity.isValid&&(entity.getComponent("minecraft:health")?.currentValue??1)>0&&entity.getProperty("dungeons:bullethell")===true;
    for(let wave=0;wave<8;wave++)system.runTimeout(()=>{
        if(!active())return;
        entity.triggerEvent("dungeons:bullethell_projectile");
    },1+wave*36);
    for(const delay of [2,150])system.runTimeout(()=>{
        if(active())fireArea(entity.getDynamicProperty("dungeons:home")??entity.location,entity.dimension,entity);
    },delay);
});

//minions

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if (id == "dungeons:despawn_wretched_wraith_minion") {
        const dim = entity.dimension;
        const loc = entity.location;
        dim.spawnParticle("dungeons:wraith_teleport_out", loc)
        dim.playSound("mob.wraith.teleport", loc, { pitch: 1 })
        entity.remove()

    } else if (id == "dungeons:spawn_wretched_wraith_minion") {
        const dim = entity.dimension;
        const loc = entity.location;
        dim.spawnParticle("dungeons:wraith_teleport_in", loc)
        dim.playSound("mob.wraith.teleport", loc, { pitch: 1.5 })
    }
});

//tick fire
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:wraith_fire_hit' && entity.typeId == "dungeons:wretched_wraith_fire") {
        if (!entity.isValid) return;
        const dim = entity.dimension;
        const loc = entity.location;
        if (Math.random() > 0.25) dim.spawnParticle("dungeons:wretched_wraith_fire_smoke", loc)
        const damageRange = dim.getEntitiesAtBlockLocation(loc)
        if (damageRange.length < 1) return;
        var targets = []

        var damage = 7
        if (world.getDifficulty() == "Hard") damage += 4
        if (world.getDifficulty() == "Easy") damage -= 2
        for (const damaged of damageRange) {
            if (targets.includes(damaged)) continue;
            if (damaged.matches({ families: ["undead"] })) continue;
            if (damaged.matches({ families: ["monster"] })) continue;
            if (damaged.getEffect("fire_resistance")) continue;
            if (damaged.typeId == "minecraft:player") {
                if (damaged.getGameMode() == "Creative") continue;
            }
            if (damaged.matches({ families: ["player"] }) || damaged.matches({ families: ["mob"] }) || damaged.matches({ families: ["animal"] })) targets.push(damaged)
        }
        if (targets.length < 1) return;
        for (const target of targets) {
            const didDamage = target.applyDamage(damage, { cause: EntityDamageCause.fire })
            if (didDamage && damage > 3) {
                target.setOnFire(1.5)
            }
        }
    }
})

//spawn fire
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (entity.typeId == "dungeons:wretched_wraith_fire" && id == "minecraft:entity_spawned") {
        const dim = entity.dimension;
        const loc = entity.location;
        const landing = landingAt(dim,loc.x,loc.z,loc.y,{height:1,maxDrop:4,maxRise:1});
        if (!landing) {entity.remove();return;}
        entity.addEffect("invisibility", 3, {showParticles:false});
        if (dim.getEntities({location:landing,families:["dungeons_fire"],maxDistance:.1}).some(other=>other.id!==entity.id)) {entity.remove();return;}
        if (!entity.tryTeleport(landing, {checkForBlocks:true})) {entity.remove();return;}
        entity.setDynamicProperty("dungeons:fire_type", "wretched_wraith")
        dim.playSound("mob.wraith.fire", landing, { pitch: 0.5 })
    }
})

//fire on floor

function fireArea(loc, dim, owner) {
    if (!loc) return;
    // Attack work is spread across ticks, and stops if its owner unloads/dies.
    system.runJob((function* () {
        for (let x=-15;x<=15;x++) for (let z=-15;z<=15;z++) {
            if (!owner.isValid) return;
            const p=landingAt(dim,loc.x+x,loc.z+z,loc.y,{height:1,maxDrop:3,maxRise:0});
            if (p) {
                const floor=readBlock(dim,{...p,y:p.y-1});
                const nether=dim.id==='minecraft:nether'||dim.id==='nether';
                if ((nether&&solidFloor(floor))||floor?.typeId.includes('ice')) {
                    if (!dim.getEntities({location:p,families:['dungeons_fire'],maxDistance:.1}).length)
                        dim.spawnEntity('dungeons:wretched_wraith_fire',p);
                }
            }
            yield;
        }
    })());
}
