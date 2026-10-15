import { EntityDamageCause, DimensionTypes } from "@minecraft/server";
import { world } from "./runtime.js";
import { scopedSystem } from "./runtime.js";
const system = scopedSystem("wildfire");


import { isValidTarget, getDirection, makeVector } from "./helpers.js"

function wildfireBlast(entity) {
    var loc = entity.location;
    const dim = entity.dimension;
    dim.playSound("random.explode", loc, { pitch: 1.2 })
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 4,
        excludeFamilies: ['ignore', 'monster']
    });
    for (const target of damageRange) {
        if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
            var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z) * 3)
            const damage = target.applyDamage(20 - distanceBetween, { cause: EntityDamageCause.entityExplosion, damagingEntity: entity });
            if (damage) {
                if (target.typeId == "minecraft:player") {
                    target.runCommand("camerashake add @s 0.1 2")
                    target.runCommand("camerashake add @s 0.1 1.5")
                    target.runCommand("camerashake add @s 0.1 1")
                    target.runCommand("camerashake add @s 0.1 0.5")
                }
                const dir = getDirection(loc, target.location);
                target.applyKnockback(makeVector(dir, 1.2), 1)
            }
        }
    }
}

//explode
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:destroy_shield' && entity.typeId == "dungeons:boss_wildfire") {
        entity.triggerEvent("dungeons:begin_shockwave")
    }
    if (id === 'dungeons:shockwave_damage' && entity.typeId == "dungeons:boss_wildfire") {
        const loc = entity.location;
        const dim = entity.dimension;
        wildfireBlast(entity)
        const blazes = dim.getEntities({ tags: ["dungeons:hovering_inferno_minion"] })
        if (blazes.length < 1) {
            spawnBlaze(dim, { x: loc.x + 2, y: loc.y, z: loc.z + 2 })
            spawnBlaze(dim, { x: loc.x - 2, y: loc.y, z: loc.z - 2 })
        } else if (blazes.length < 2) {
            spawnBlaze(dim, { x: loc.x + 2, y: loc.y, z: loc.z + 2 })

        }
    }
});


//minions
function spawnBlaze(dim, loc) {
    dim.spawnParticle("dungeons:wildfire_flames", loc)
    dim.spawnParticle("dungeons:wildfire_flames", { x: loc.x, y: loc.y + 0.75, z: loc.z })
    dim.playSound("mob.evocation_illager.prepare_summon", loc, { volume: 0.5, pitch: 2 + Math.random() })
    spawned("minecraft:blaze", loc, dim)
}

function spawned(id, loc, dim) {
    const entity = dim.spawnEntity(id, loc, { initialPersistence: true })
    entity.addTag("dungeons:hovering_inferno_minion")
}

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const mob of dim.getEntities({ tags: ["dungeons:hovering_inferno_minion"] })) {

            var loc = mob.location;
            const necromancerNearby = dim.getEntities({ location: loc, maxDistance: 32, type: "dungeons:boss_wildfire" })
            if (necromancerNearby.length == 0) {
                dim.spawnParticle("dungeons:wildfire_flames", loc)
                dim.spawnParticle("dungeons:wildfire_flames", { x: loc.x, y: loc.y + 0.75, z: loc.z })
                mob.remove()
            }
        }
    }
})