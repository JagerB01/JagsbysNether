import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "rampaging"

world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        system.run(() => {
            damageSource.addEffect("speed", 55)
            damageSource.addEffect("strength", 55)
        })
    }
});