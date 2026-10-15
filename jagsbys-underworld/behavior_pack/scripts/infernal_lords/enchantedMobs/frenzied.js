import { DimensionTypes } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "frenzied"

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const hp = entity.getComponent("health")
                if (hp.defaultValue / 2 >= hp.currentValue) {
                    entity.addEffect("strength", 5, { amplifier: 1 })
                    if (entity.hasTag("dungeons:enchanted_mob_quick")) {
                        entity.addEffect("speed", 5, { amplifier: 4 })

                    } else {
                        entity.addEffect("speed", 5, { amplifier: 1 })

                    }
                }

            }
        }
    }
})