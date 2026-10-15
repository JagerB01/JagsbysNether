import { world } from "../runtime.js";


const id = "freezing"

world.afterEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const hurt = e.hurtEntity;
        if (!hurt) return;
        if (!hurt.isValid) return;
        const slownessOnTarget = hurt.getEffect("slowness")
        if (slownessOnTarget) {
            if (slownessOnTarget.duration > 20) return;
        }
        hurt.addEffect("slowness", 120, { amplifier: 1 })
        const dim = hurt.dimension;
        dim.spawnParticle("dungeons:satchel_elements_ice", hurt.getHeadLocation())
        dim.playSound("mob.player.hurt_freeze", hurt.location, { volume: 0.5 })
    }
});