import { world } from "../runtime.js";


const id = "cowardice"

world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const health = damageSource.getComponent("health")
        if (Math.ceil(health.currentValue) >= health.defaultValue) e.damage = e.damage * 2
    }
});