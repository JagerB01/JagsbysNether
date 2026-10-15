import { DimensionTypes } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "gravity_pulse"
import { isValidTarget, gravityTo } from "../helpers.js"

function gravityPulse(targetLoc, dim, owner) {


    var large = false
    if (owner.hasTag("dungeons:enchanted_mob_huge")) large = true
    var range = 6
    if (large) range = 12
    const gravityTargets = dim.getEntities({
        location: targetLoc,
        maxDistance: range,
        minDistance: range / 12,
        excludeFamilies: ['ignore', 'gravity_immune']
    });
    system.run(() => {
        if (dim.isChunkLoaded(targetLoc)) {
            if (!large) dim.spawnParticle("dungeons:ranged_gravity", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
            if (large) dim.spawnParticle("dungeons:large_gravity_pulse", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
            dim.playSound("mob.endermen.portal", targetLoc, { pitch: 0.65 })
        }
        for (const target of gravityTargets) {
            if (target.typeId == "minecraft:player") gravityTo(target, targetLoc)
        }
    })
}

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const playersNearby = dim.getPlayers({ location: entity.location, maxDistance: 20 })
                if (playersNearby.length == 0) continue;
                gravityPulse(entity.location, dim, entity)
            }
        }
    }
}, 100)
