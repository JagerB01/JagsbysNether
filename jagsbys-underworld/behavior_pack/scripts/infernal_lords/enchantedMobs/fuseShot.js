import { EntityDamageCause } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


import { getDirection, makeVector, isValidTarget } from "../helpers.js"
const id = "fuse_shot"

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity || !entity.isValid || !["minecraft:arrow", "dungeons:enchanted_arrow"].includes(entity.typeId)) return;
    const projectile = entity.getComponent("projectile")
    if (!projectile?.owner) return;
    if (projectile.owner.hasTag("dungeons:enchanted_mob_" + id)) {
        entity.addTag("dungeons:fuseshot_mob_arrow")
    }
})



function bowExplosion(projectile, attacker, loc, dim, particleType) {
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 3,
        excludeFamilies: ['ignore']
    });
    system.run(() => {
        for (const target of damageRange) {
            if (isValidTarget(target) == false) continue;
            if (target === attacker) continue;
            if (target.matches({families:["monster"]})) continue;
            var distanceBetween = Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)
            distanceBetween = Math.round(distanceBetween)
            const damageDone = target.applyDamage(15 - distanceBetween, {cause: EntityDamageCause.entityExplosion, damagingEntity: attacker})
            if (!damageDone) continue;
            const dir = getDirection(loc, target.location);
            target.applyKnockback(makeVector(dir, 0.5), 0.23)
        }
        if (dim.isChunkLoaded(loc)) {
            dim.spawnParticle("dungeons:" + particleType + "_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
            dim.spawnParticle("dungeons:" + particleType + "_boom_dust", loc)
            dim.playSound("random.explode", loc, { pitch: 0.7 })
        }
        system.runTimeout(() => {

            if (projectile.isValid) projectile.remove()
        })
    })
}

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile?.owner) return;
    if (!projectile.isValid) return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;
    if (!projectile.hasTag("dungeons:fuseshot_mob_arrow")) return;
    //effect code
    if (e.damage <= 0) return;
    var particleId = "fuse_shot"
    if (projectile.hasTag("dungeons:purple_visuals_bow_effect")) particleId = "purple_fuse_shot"
    bowExplosion(projectile, attacker, projectile.location, projectile.dimension, particleId)
});

world.afterEvents.projectileHitBlock.subscribe((e) => {
    const projectile = e.projectile
    if (!projectile?.owner) return;
    if (!projectile.isValid) return;
    const player = e.source;
    if (!player) return;
    if (!player.isValid) return;
    if (!projectile.hasTag("dungeons:fuseshot_mob_arrow")) return;
    //effect code
    if (e.damage <= 0) return;
    var particleId = "fuse_shot"
    if (projectile.hasTag("dungeons:purple_visuals_bow_effect")) particleId = "purple_fuse_shot"
    bowExplosion(projectile, player, e.location, e.dimension, particleId)
})