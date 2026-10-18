import {shockwaveDamage,bossDamage,BOSS_DAMAGE} from './boss_damage.js';
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
            const distanceBetween = Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)
            const damage = target.applyDamage(shockwaveDamage(distanceBetween,world.getDifficulty()), { cause: EntityDamageCause.entityExplosion, damagingEntity: entity });
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
        const blazes = dim.getEntities({location:loc,maxDistance:32,tags:["dungeons:hovering_inferno_minion"]}).filter(m=>!m.getDynamicProperty("jagsby_nether:boss_owner")||m.getDynamicProperty("jagsby_nether:boss_owner")===entity.id)
        if (blazes.length < 1) {
            spawnBlaze(dim, { x: loc.x + 2, y: loc.y, z: loc.z + 2 },entity)
            spawnBlaze(dim, { x: loc.x - 2, y: loc.y, z: loc.z - 2 },entity)
        } else if (blazes.length < 2) {
            spawnBlaze(dim, { x: loc.x + 2, y: loc.y, z: loc.z + 2 },entity)

        }
    }
});


//minions
function spawnBlaze(dim, loc, owner) {
    dim.spawnParticle("dungeons:wildfire_flames", loc)
    dim.spawnParticle("dungeons:wildfire_flames", { x: loc.x, y: loc.y + 0.75, z: loc.z })
    dim.playSound("mob.evocation_illager.prepare_summon", loc, { volume: 0.5, pitch: 2 + Math.random() })
    spawned("dungeons:enchanted_blaze", loc, dim, owner)
}

function spawned(id, loc, dim, owner) {
    const entity = dim.spawnEntity(id, loc, { initialPersistence: true })
    entity.addTag("dungeons:hovering_inferno_minion")
    entity.setDynamicProperty("jagsby_nether:boss_owner",owner.id)
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
// Scale only this boss projectile; native armour/Protection/Fire Resistance
// behavior is retained (Fire Resistance stops burning, not impact damage).
world.beforeEvents.entityHurt.subscribe(event=>{
 if(event.damageSource.cause!==EntityDamageCause.projectile||event.damageSource.damagingProjectile?.typeId!=='dungeons:boss_wildfire_fireball')return;
 event.damage*=bossDamage('standard',world.getDifficulty())/BOSS_DAMAGE.standard;
});
