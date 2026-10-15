import { EntityDamageCause, BlockVolume } from "@minecraft/server";
import { world } from "./runtime.js";
import { scopedSystem } from "./runtime.js";
const system = scopedSystem("actors");


const teleportHiddenTime = 10
import { isValidTarget, getDirection, makeVector } from "./helpers.js"



world.afterEvents.projectileHitBlock.subscribe((e) => {
    const entity = e.projectile;
    const loc = e.location;
    const dim = e.dimension;
    if (entity.typeId == "dungeons:wretched_wraith_projectile") {
        if (!entity.isValid) return;
        entity.remove()
        return;
    }
})
world.afterEvents.projectileHitEntity.subscribe((e) => {
    const entity = e.projectile;
    const hit = e.getEntityHit().entity
    if (!hit.isValid) return;
    const dim = hit.dimension
    const loc = e.location;
    if (entity.typeId == "dungeons:wretched_wraith_projectile") {
        system.runTimeout(() => {
            if (entity.isValid) entity.remove()
        }, 100)
        if (!entity.isValid) return;
        const proj = entity.getComponent("minecraft:projectile")
        const owner = proj.owner;
        if (!owner || !owner.isValid) {
            entity.remove()
            return;
        }
        if (hit.matches({ families: ["undead"] })) return;
        if (hit.matches({ families: ["monster"] })) return;
        if (entity.hasTag("dungeons:chud_projectile")) {
            hit.applyDamage(7.5, { cause: EntityDamageCause.fire })
        } else {
            hit.applyDamage(10, { damagingEntity: owner, cause: EntityDamageCause.fire })

        }
        entity.remove()
    }
})
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

    if (hit.matches({ families: ["undead"] }) || hit.matches({ families: ["monster"] })) {
        e.cancel = true;
        e.damage = 0
    }
    if (projectile.hasTag("dungeons:chud_projectile")) {
        system.run(() => {
            hit.applyKnockback({ x: 0, z: 0 }, -0.5)
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
    if (loc == undefined) loc = entity.location;
    if (originLoc == undefined) originLoc = false
    const entityLoc = entity.location;
    const dim = entity.dimension;
    var validTeleport = false
    var teleportAttempts = 20
    for (let i = 0; i < teleportAttempts && validTeleport == false; i++) {
        var xMod = (Math.random() * 30) - 15
        var zMod = (Math.random() * 30) - 15
        if (xMod < 0 && xMod > -5) xMod = -5
        if (xMod > 0 && xMod < 5) xMod = 5
        if (zMod < 0 && zMod > -5) zMod = -5
        if (zMod > 0 && zMod < 5) zMod = 5
        var teleportLoc = { x: loc.x + xMod, y: loc.y, z: loc.z + zMod }
        teleportLoc.y = dim.getTopmostBlock({ x: teleportLoc.x, z: teleportLoc.z }, teleportLoc.y).y + 1
        if (teleportLoc.y < loc.y - 0.5 || teleportLoc.y > loc.y + 1) continue;

        const baseDist = Math.hypot(teleportLoc.x - loc.x, teleportLoc.y - loc.y, teleportLoc.z - loc.z)
        const xDif = loc.x - teleportLoc.x
        const yDif = loc.y - teleportLoc.y
        const zDif = loc.z - teleportLoc.z
        var isWalled = false;
        for (let i = 1; i < baseDist; i++) {
            const checkBlock = dim.getBlock({ x: teleportLoc.x + (xDif * (i / baseDist)), y: 1 + teleportLoc.y + (yDif * (i / baseDist)), z: teleportLoc.z + (zDif * (i / baseDist)) })
            if (!checkBlock) break;
            if (checkBlock.isAir == false) {
                isWalled = true;
            }
        }
        if (isWalled) continue;
        if (!dim.getBlock(teleportLoc)) continue;
        if (dim.getBlock(teleportLoc).above().isAir == false || dim.getBlock(teleportLoc).above().above().isAir == false) continue;
        if (!dim.getBlock(teleportLoc).below().typeId.includes("ice") && !dim.getBlock(teleportLoc).below().typeId.includes("snow")) continue;
        if (teleportLoc) validTeleport = true
    }
    if (!validTeleport || originLoc == true) {
        const homeLoc = entity.getDynamicProperty("dungeons:home")
        if (homeLoc) {
            if (dim == world.getDimension("overworld") && dim.isChunkLoaded(homeLoc)) {
                teleportLoc = homeLoc
                validTeleport = true
            }
        }
    }
    if (!validTeleport) return;
    entity.tryTeleport(teleportLoc)
    dim.playSound("mob.wraith.teleport", entityLoc, { pitch: 0.6 })
    dim.playSound("mob.wretched_wraith.bullethell", entityLoc, { pitch: 1 })
    dim.spawnParticle("dungeons:teleport_out", entityLoc)
    system.runTimeout(() => {
        if (dim.isChunkLoaded(loc)) {
            dim.playSound("mob.wraith.teleport", entityLoc, { pitch: 0.9 })
            dim.spawnParticle("dungeons:teleport_in", teleportLoc)
            if (originLoc == true && Math.random() > 0.5) {
                teleport(entity)
            }
        }
    }, teleportHiddenTime)
    entity.addEffect("invisibility", teleportHiddenTime, { showParticles: false })
    connectLine(entity, entityLoc, dim)
}
function connectLine(player, baseLoc, baseDim) {
    const baseDist = Math.hypot(baseLoc.x - player.location.x, baseLoc.y - player.location.y, baseLoc.z - player.location.z)
    for (let i = 1; i < teleportHiddenTime; i += teleportHiddenTime / baseDist) {
        system.runTimeout(() => {
            if (player.dimension !== baseDim) return;
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
        entity.addEffect("slowness", 40, { amplifier: 100, showParticles: false })
        system.runTimeout(() => {
            entity.triggerEvent("dungeons:bullethell_start")
            system.runTimeout(() => {
                fireArea(entity.getDynamicProperty("dungeons:home"), entity.dimension)
            }, 2)
            system.runTimeout(() => {
                fireArea(entity.getDynamicProperty("dungeons:home"), entity.dimension)
            }, 150)
        }, 25)
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
        const block = dim.getTopmostBlock({ x: loc.x, z: loc.z }, loc.y + 4).above()
        entity.addEffect("invisibility", 3, { showParticles: false })
        if (block.below().isAir == false) {
            const isFire = dim.getEntities({ location: block.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 })
            if (isFire.length >= 1) {
                entity.remove()
            } else {
                entity.tryTeleport(block.bottomCenter())
            }
        }
        if (!entity.isValid) return;
        entity.setDynamicProperty("dungeons:fire_type", "wretched_wraith")
        dim.playSound("mob.wraith.fire", block.bottomCenter(), { pitch: 0.5 })
    }
})

//fire on floor

function fireArea(loc, dim) {
    var corner1 = { x: loc.x - 15, y: loc.y + -2, z: loc.z - 15 }
    var corner2 = { x: loc.x + 15, y: loc.y - 3, z: loc.z + 15 }
    var volume = dim.getBlocks((new BlockVolume(corner1, corner2)), {})
    for (const blockLoc of volume.getBlockLocationIterator()) {
        let nblock = dim.getBlock(blockLoc)
        if (nblock.typeId.includes("ice") && nblock.above().isAir) {
            const isFire = dim.getEntities({ location: nblock.above().bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 })
            if (isFire.length == 0) {
                //nblock.above().setType("iron_block")
                dim.spawnEntity("dungeons:wretched_wraith_fire", nblock.above().location)
            }
        }
    }
}
