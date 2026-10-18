import {landingAt,teleportDestination} from './teleport.js';
import {casterHit,casterLinger,fireCastHits} from './arena_damage.js';
import { EntityDamageCause } from "@minecraft/server";
import { world } from "./runtime.js";
import { scopedSystem } from "./runtime.js";
const system = scopedSystem("actors");


//spawn animation
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    if (entity.matches({families:["wraith"]})) {
        if (!entity.dimension.isChunkLoaded(entity.location)) return;
        entity.dimension.spawnParticle("dungeons:tower_wraith_black", entity.location)
    }
})

//teleport

const teleportHiddenTime = 10

function teleport(entity, loc) {
    if (loc == undefined) loc = entity.location;
    const entityLoc = entity.location;
    const dim = entity.dimension;
    const teleportLoc=teleportDestination(entity,loc,{requireSight:true});
    if(!teleportLoc||!entity.tryTeleport(teleportLoc))return;
    dim.playSound("mob.wraith.teleport", entityLoc, { pitch: 1 })
    dim.spawnParticle("dungeons:wraith_teleport_out", entityLoc)
    system.runTimeout(() => {
        if (dim.isChunkLoaded(loc)) {
            dim.playSound("mob.wraith.teleport", entityLoc, { pitch: 1.4 })
            dim.spawnParticle("dungeons:wraith_teleport_in", teleportLoc)
        }
    }, teleportHiddenTime)
    entity.addEffect("invisibility", 1, { showParticles: false })
    connectLine(entity, entityLoc, dim)
}
function connectLine(player, baseLoc, baseDim) {
    const baseDist = Math.hypot(baseLoc.x - player.location.x, baseLoc.y - player.location.y, baseLoc.z - player.location.z)
    for (let i = 1; i < teleportHiddenTime; i += teleportHiddenTime / baseDist) {
        system.runTimeout(() => {
            if (!player.isValid || player.dimension !== baseDim) return;
            const targetLoc = player.location;
            const xDif = targetLoc.x - baseLoc.x
            const yDif = targetLoc.y - baseLoc.y
            const zDif = targetLoc.z - baseLoc.z
            const particleLoc = { x: baseLoc.x + (xDif * (i / teleportHiddenTime)), y: 1 + baseLoc.y + (yDif * (i / teleportHiddenTime)), z: baseLoc.z + (zDif * (i / teleportHiddenTime)) }
            if (player.dimension.isChunkLoaded(particleLoc)) {
                player.dimension.spawnParticle("dungeons:wraith_teleport_beam", particleLoc)
            }
        }, i)
    }
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if ((id === 'dungeons:begin_teleport' || id === "dungeons:teleport_despawn") && (entity.typeId == "dungeons:wraith" || entity.typeId == "dungeons:enchanted_wraith" || entity.typeId == "dungeons:ancient_terror")) {
        entity.playAnimation("animation.wraith.teleport_away")
        entity.addEffect("slowness", 60, { amplifier: 99, showParticles: false })
        entity.extinguishFire()
        entity.addEffect("fire_resistance", 60, { amplifier: 0, showParticles: false })
    }
    if (id === 'dungeons:teleport' && (entity.typeId == "dungeons:wraith" || entity.typeId == "dungeons:enchanted_wraith" || entity.typeId == "dungeons:ancient_terror")) {
        entity.playAnimation("animation.wraith.teleport_in")
        entity.addEffect("invisibility", 1, { amplifier: 0, showParticles: false })
        teleport(entity)
    }
})

//tick fire
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:wraith_fire_hit' && entity.typeId == "dungeons:wraith_fire") {
        if (!entity.isValid) return;
        const dim = entity.dimension;
        const loc = entity.location;
        if (Math.random() > 0.25) dim.spawnParticle("dungeons:wraith_fire_smoke", loc)
        const damageRange = dim.getEntitiesAtBlockLocation(loc)
        if (damageRange.length < 1) return;
        var targets = []

        const towerFire=entity.getDynamicProperty("dungeons:fire_type")==="tower_wraith";
        const hitPlayers=towerFire?fireCastHits(entity.getDynamicProperty("jagsby_nether:fire_cast")??entity.id,system.currentTick):undefined;
        var damage = 2
        if (world.getDifficulty() == "Hard") damage += 1
        if (world.getDifficulty() == "Easy") damage -= 1
        if (entity.getDynamicProperty("dungeons:fire_type") == "enchanted_wraith") damage = damage * 1.5
        if (entity.getDynamicProperty("dungeons:fire_type") == "ancient_wraith") damage = damage * 2
        for (const damaged of damageRange) {
            if (targets.includes(damaged)) continue;
            if (damaged.matches({ families: ["undead"] })) continue;
            if (damaged.matches({ families: ["monster"] })) continue;
            if (damaged.getEffect("fire_resistance")) continue;
            if (damaged.typeId == "minecraft:player") {
                if (["Creative","Spectator"].includes(damaged.getGameMode())) continue;
            }
            if (damaged.matches({ families: ["player"] }) || damaged.matches({ families: ["mob"] }) || damaged.matches({ families: ["animal"] })) targets.push(damaged)
        }
        if (targets.length < 1) return;
        for (const target of targets) {
            const hitDamage=towerFire?(hitPlayers.has(target.id)?casterLinger(world.getDifficulty()):casterHit(world.getDifficulty())):damage;
            const didDamage = target.applyDamage(hitDamage, { cause: EntityDamageCause.fire })
            if (didDamage && towerFire) hitPlayers.add(target.id);
            if (didDamage && damage > 1) target.setOnFire(towerFire?1:damage - 0.95)
        }
    }
})

// Resolve the target's local floor, not an upper storey or the Nether ceiling.
function fireBlock(d,loc){
 const p=landingAt(d,loc.x,loc.z,loc.y,{height:1,halfWidth:0,maxDrop:4,maxRise:1});
 return p?d.getBlock(p):undefined;
}

//spawn fire
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    if(!entity.isValid || entity.typeId!=="dungeons:wraith_fire")return;
    const sourceId=entity.id;
    const id = e.eventId;
    if (id === 'dungeons:spawn_wraith_fire' && entity.typeId == "dungeons:wraith_fire") {
        const dim = entity.dimension;
        const loc = entity.location;
        const block=fireBlock(dim,loc);
        if(!block)return entity.remove();
        entity.addEffect("invisibility", 3, { showParticles: false })
        if (block.below().isAir == false) {
            const isFire = dim.getEntities({ location: block.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
            if (isFire.length >= 1) {
                entity.remove()
            } else {
                entity.tryTeleport(block.bottomCenter())
            }
        }
        if (!entity.isValid) return;
        entity.setDynamicProperty("dungeons:fire_type", "wraith")
        dim.playSound("mob.wraith.fire", block.bottomCenter())
        const offsets = [
            { x: 1, z: -1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: -1, z: -1 },
            { x: -1, z: 0 },
            { x: -1, z: 1 }
        ]
        system.runTimeout(() => {
            for (const offset of offsets) {
                const newSpawnLoc = { x: block.x + offset.x, y: block.y, z: block.z + offset.z }
                const newblock=fireBlock(dim,newSpawnLoc);
                if(!newblock)continue;
                if (newblock.below().isAir == false) {
                    const isFire = dim.getEntities({ location: newblock.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
                    if (isFire.length >= 1) continue;
                    const newFire = dim.spawnEntity(entity.typeId, newblock.bottomCenter())
                    newFire.setDynamicProperty("dungeons:fire_type", "wraith")
                    newFire.addEffect("invisibility", 3, { showParticles: false })
                }
            }
        }, 3)
    } else if (id === 'dungeons:spawn_enchanted_wraith_fire' && entity.typeId == "dungeons:wraith_fire") {
        const dim = entity.dimension;
        const loc = entity.location;
        const block=fireBlock(dim,loc);
        if(!block)return entity.remove();
        entity.addEffect("invisibility", 3, { showParticles: false })
        if (block.below().isAir == false) {
            const isFire = dim.getEntities({ location: block.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
            if (isFire.length >= 1) {
                entity.remove()
            } else {
                entity.tryTeleport(block.bottomCenter())
            }
        }
        if (!entity.isValid) return;
        entity.setDynamicProperty("dungeons:fire_type", "enchanted_wraith")
        dim.playSound("mob.wraith.fire", block.bottomCenter())
        const offsets = [
            { x: 1, z: -1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: -1, z: -1 },
            { x: -1, z: 0 },
            { x: -1, z: 1 }
        ]
        system.runTimeout(() => {
            for (const offset of offsets) {
                const newSpawnLoc = { x: block.x + offset.x, y: block.y, z: block.z + offset.z }
                const newblock=fireBlock(dim,newSpawnLoc);
                if(!newblock)continue;
                if (newblock.below().isAir == false) {
                    const isFire = dim.getEntities({ location: newblock.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
                    if (isFire.length >= 1) continue;
                    const newFire = dim.spawnEntity(entity.typeId, newblock.bottomCenter())
                    newFire.setDynamicProperty("dungeons:fire_type", "enchanted_wraith")
                    newFire.addEffect("invisibility", 3, { showParticles: false })
                }
            }
        }, 3)
    } else if (id === 'dungeons:spawn_ancient_wraith_fire' && entity.typeId == "dungeons:wraith_fire") {
        const dim = entity.dimension;
        const loc = entity.location;
        const block=fireBlock(dim,loc);
        if(!block)return entity.remove();
        entity.addEffect("invisibility", 3, { showParticles: false })
        if (block.below().isAir == false) {
            const isFire = dim.getEntities({ location: block.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
            if (isFire.length >= 1) {
                entity.remove()
            } else {
                entity.tryTeleport(block.bottomCenter())
            }
        }
        if (!entity.isValid) return;
        entity.setDynamicProperty("dungeons:fire_type", "ancient_wraith")
        dim.playSound("mob.wraith.fire", block.bottomCenter())
        const offsets = [
            { x: 1, z: -1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: -1, z: -1 },
            { x: -1, z: 0 },
            { x: -1, z: 1 }
        ]
        system.runTimeout(() => {
            for (const offset of offsets) {
                const newSpawnLoc = { x: block.x + offset.x, y: block.y, z: block.z + offset.z }
                const newblock=fireBlock(dim,newSpawnLoc);
                if(!newblock)continue;
                if (newblock.below().isAir == false) {
                    const isFire = dim.getEntities({ location: newblock.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
                    if (isFire.length >= 1) continue;
                    const newFire = dim.spawnEntity(entity.typeId, newblock.bottomCenter())
                    newFire.setDynamicProperty("dungeons:fire_type", "ancient_wraith")
                    newFire.addEffect("invisibility", 3, { showParticles: false })
                }
            }
        }, 3)
    } else if (id === 'dungeons:spawn_tower_wraith_fire' && entity.typeId == "dungeons:wraith_fire") {
        const dim = entity.dimension;
        const loc = entity.location;
        const block=fireBlock(dim,loc);
        if(!block)return entity.remove();
        entity.addEffect("invisibility", 3, { showParticles: false })
        if (block.below().isAir == false) {
            const isFire = dim.getEntities({ location: block.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
            if (isFire.length >= 1) {
                entity.remove()
            } else {
                entity.tryTeleport(block.bottomCenter())
            }
        }
        if (!entity.isValid) return;
        entity.setDynamicProperty("dungeons:fire_type", "tower_wraith")
        const castId=entity.id;
        entity.setDynamicProperty("jagsby_nether:fire_cast", castId)
        dim.playSound("mob.wraith.fire", block.bottomCenter())
        const offsets = [
            { x: 2, z: 1 },
            { x: 2, z: 0 },
            { x: 2, z: -1 },
            { x: 1, z: 2 },
            { x: 1, z: 1 },
            { x: 1, z: 0 },
            { x: 1, z: -1 },
            { x: 1, z: -2 },
            { x: 0, z: 2 },
            { x: 0, z: 1 },
            { x: 0, z: -1 },
            { x: 0, z: -2 },
            { x: -1, z: 2 },
            { x: -1, z: 1 },
            { x: -1, z: 0 },
            { x: -1, z: -1 },
            { x: -1, z: -2 },
            { x: -2, z: 1 },
            { x: -2, z: 0 },
            { x: -2, z: -1 }
        ]
        system.runTimeout(() => {
            for (const offset of offsets) {
                const newSpawnLoc = { x: block.x + offset.x, y: block.y, z: block.z + offset.z }
                const newblock=fireBlock(dim,newSpawnLoc);
                if(!newblock)continue;
                if (newblock.below().isAir == false) {
                    const isFire = dim.getEntities({ location: newblock.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
                    if (isFire.length >= 1) continue;
                    const newFire = dim.spawnEntity(entity.typeId, newblock.bottomCenter())
                    newFire.setDynamicProperty("dungeons:fire_type", "tower_wraith")
                    newFire.setDynamicProperty("jagsby_nether:fire_cast", castId)
                    newFire.addEffect("invisibility", 3, { showParticles: false })
                }
            }
        }, 3)
    } else if (entity.typeId == "dungeons:wraith_fire" && id == "dungeons:spawn_rolling_flame_fire") {
        const dim = entity.dimension;
        const loc = entity.location;
        const block=fireBlock(dim,loc);
        if(!block)return entity.remove();
        entity.addEffect("invisibility", 3, { showParticles: false })
        if (block.below().isAir == false) {
            const isFire = dim.getEntities({ location: block.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
            if (isFire.length >= 1) {
                entity.remove()
            } else {
                entity.tryTeleport(block.bottomCenter())
            }
        }
        if (!entity.isValid) return;
        entity.setDynamicProperty("dungeons:fire_type", "enchanted_wraith")
        dim.playSound("mob.wraith.fire", block.bottomCenter())
    } else if (entity.typeId == "dungeons:wraith_fire" && id == "minecraft:entity_spawned") {
        const dim = entity.dimension;
        const loc = entity.location;
        const block=fireBlock(dim,loc);
        if(!block)return entity.remove();
        entity.addEffect("invisibility", 3, { showParticles: false })
        if (block.below().isAir == false) {
            const isFire = dim.getEntities({ location: block.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 }).filter(other=>other.id!==sourceId)
            if (isFire.length >= 1) {
                entity.remove()
            } else {
                entity.tryTeleport(block.bottomCenter())
            }
        }
        if (!entity.isValid) return;
        entity.setDynamicProperty("dungeons:fire_type", "enchanted_wraith")
        dim.playSound("mob.wraith.fire", block.bottomCenter())
    }
})