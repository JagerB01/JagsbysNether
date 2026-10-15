import { DimensionTypes } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "burning"

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
    var range = 3.5
    if (large) range = 5
                const playersNearby = dim.getPlayers({ location: loc, maxDistance: range, excludeGameModes: ["Spectator", "Creative"] })
                var effects = false
                for (const player of playersNearby) {
                    var damage = player.applyDamage(2, { cause: "fire" })
                    if (effects == false) effects = damage
                }
                if (effects) {
                    dim.spawnParticle("dungeons:satchel_elements_use_fire", { x: loc.x, y: loc.y + 0.5, z: loc.z })
                }
            }
        }
    }
}, 10)
