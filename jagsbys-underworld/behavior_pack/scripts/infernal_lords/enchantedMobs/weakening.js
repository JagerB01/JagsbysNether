import { world } from "../runtime.js";


const id = "weakening"

world.afterEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const hurt = e.hurtEntity;
        if (!hurt) return;
        if (!hurt.isValid) return;
        if (hurt.getEffect("weakness")) return;
        hurt.addEffect("weakness", 200, { amplifier: 1 })
        const dim = hurt.dimension;
        const loc = hurt.location
        dim.spawnParticle('dungeons:cauldron_summon', {
            x: loc.x,
            y: loc.y + 1,
            z: loc.z
        });
    }
});