import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "critical_hit"

world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const rand = Math.random()
        if (rand > 0.2) return;
        e.damage = e.damage * 3
        const hit = e.hurtEntity
        if (!hit) return;
        if (!hit.isValid) return;
        system.run(() => {
            const dim = hit.dimension
            const hurtLoc = hit.location;
            dim.spawnParticle("dungeons:skull_crit", hurtLoc)
            dim.spawnParticle("dungeons:skull_burst", hurtLoc)
            dim.playSound("random.anvil_land", hurtLoc, { volume: 0.7, pitch: 1.5 })
        })
    }
});