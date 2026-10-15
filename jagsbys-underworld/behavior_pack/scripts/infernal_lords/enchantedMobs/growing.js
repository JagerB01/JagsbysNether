import { EntityDamageCause } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


import { getDirection, makeVector } from "../helpers.js"
const id = "growing"

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity || !entity.isValid || !["minecraft:arrow", "dungeons:enchanted_arrow"].includes(entity.typeId)) return;
    const projectile = entity.getComponent("projectile")
    if (!projectile?.owner) return;
    if (entity.typeId === "dungeons:enchanted_arrow" && projectile.owner.hasTag("dungeons:enchanted_mob_" + id)) {
        entity.addTag("dungeons:growing_mob_arrow")
    }
})

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (let entity of dim.getEntities({
            tags: ["dungeons:growing_mob_arrow"]
        })) {
            entity.playAnimation("animation.arrow.scale")
            const scale = entity.getProperty("dungeons:scale")
            if (scale < 40 && !entity.isOnGround) {
                entity.setProperty("dungeons:scale", scale + 1)
            }
            if (scale > 10 && scale <= 39 && !entity.isOnGround && (scale - 1) % 9 == 0) entity.triggerEvent("dungeons:scale_" + `${(scale)}`)
        }
    }
})

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
    if (!["minecraft:arrow", "dungeons:enchanted_arrow"].includes(projectile.typeId)) return
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;
    if (!projectile.hasTag("dungeons:growing_mob_arrow")) return;
    //effect code
    if (e.damage <= 0) return;
    const scale = projectile.getProperty("dungeons:scale")
    var damageBuff = scale / 7
    e.damage = e.damage * damageBuff
    const dir = getDirection(projectile.location, hurt.location)
    system.run(() => {
        hurt.applyKnockback(makeVector(dir, scale / 3 / 1.5), 0.33)
    })

});