import { MolangVariableMap } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "rush"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurtEntity = e.hurtEntity;
    if (!hurtEntity) return;
    if(!hurtEntity.isValid) return;
    if (hurtEntity.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const dim = hurtEntity.dimension;
        var loc = hurtEntity.location;
        dim.spawnParticle('dungeons:swiftness', loc)
        dim.playSound("armour.rush.activate", loc)
        if (hurtEntity.hasTag("dungeons:enchanted_mob_quick")) {
            hurtEntity.addEffect("speed", 45, { amplifier: 7 })

        } else {
            hurtEntity.addEffect("speed", 45, { amplifier: 4 })

        }
    }
});