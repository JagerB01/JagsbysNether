import { world } from "../runtime.js";


const id = "committed"

world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        if (e.damage <= 0) return;
        const hurt = e.hurtEntity;
        if (!hurt) return;
        if (!hurt.isValid) return;
        const hp = hurt.getComponent("health")
        const preHitHealth = hp.currentValue + e.damage
        const missingPct = 1 - (preHitHealth / hp.effectiveMax)
        const finalMult = Math.min(2,Math.max(1 + missingPct, 1))
        e.damage = e.damage * finalMult
    }
});