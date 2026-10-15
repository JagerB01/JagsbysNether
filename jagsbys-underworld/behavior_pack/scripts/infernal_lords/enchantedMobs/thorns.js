import { MolangVariableMap } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "thorns"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurtEntity = e.hurtEntity;
    if (!hurtEntity) return;
    if (!hurtEntity.isValid) return;
    if (hurtEntity.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const dim = hurtEntity.dimension;
        var loc = hurtEntity.location;
        const thornDmg = e.damage / 5
        const attacker = e.damageSource.damagingEntity;
        if (!attacker) return;
        if (!attacker.isValid) return;
        const dmg = attacker.applyDamage(thornDmg, { cause: "thorns", damagingEntity: hurtEntity })
        if (dmg) dim.playSound("damage.thorns", loc, { volume: 0.5 })
    }
});