import { world } from "../runtime.js";


const id = "double_damage"

world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        if (damageSource.matches({ families: ["ancient"] })) {
            e.damage = e.damage * 1.5
        } else {
            e.damage = e.damage * 2
        }
    }
});