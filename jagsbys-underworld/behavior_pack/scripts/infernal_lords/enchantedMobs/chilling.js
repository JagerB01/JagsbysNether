import { DimensionTypes } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "chilling"

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const loc = entity.location

    var large = false
    if (entity.hasTag("dungeons:enchanted_mob_huge")) large = true
    var range = 7.5
    if (large) range = 15
                const playersNearby = dim.getPlayers({ location: loc, maxDistance: range, excludeGameModes: ["Spectator", "Creative"] })
                var effects = false
                for (const player of playersNearby) {
                    const slownessOnTarget = player.getEffect("slowness")
                    if (slownessOnTarget) {
                        if (slownessOnTarget.duration > 60) continue;
                    }
                    effects = true
                    player.addEffect("slowness", 55, { amplifier: 1 })
                    dim.spawnParticle("dungeons:satchel_elements_ice", player.getHeadLocation())
                    player.playSound("mob.player.hurt_freeze", { volume: 0.5 })
                }
                if (effects) {
                    dim.spawnParticle("dungeons:satchel_elements_use_ice", { x: loc.x, y: loc.y + 0.5, z: loc.z })
                }
            }
        }
    }
}, 40)
