import { DimensionTypes } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "regeneration"

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const onfire = entity.getComponent("onfire")
                if (onfire) return;
                const hp = entity.getComponent("health")
                var amt = 0.5
                if(world.getDifficulty() == "Normal") amt = 1
                if(world.getDifficulty() == "Hard") amt = 1.33

                if (hp.currentValue + amt <= hp.defaultValue) {
                    hp.setCurrentValue(hp.currentValue + amt)
                } else {
                    hp.setCurrentValue(hp.defaultValue)
                }
            }
        }
    }
}, 6)