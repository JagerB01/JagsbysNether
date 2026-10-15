import { DimensionTypes } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "mob_summon_aura"

var list = [
    "minecraft:zombie",
    "minecraft:zombie",
    "minecraft:zombie",
    "minecraft:skeleton",
    "minecraft:skeleton",
    "minecraft:spider",
    "minecraft:creeper"
]

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                if (Math.random() < 0.4) continue;
                const loc = entity.location
                const playersNearby = dim.getPlayers({ location: loc, maxDistance: 16, excludeGameModes: ["Spectator"] })
                if (playersNearby.length == 0) continue;
                const minionsNearby = dim.getEntities({ location: loc, maxDistance: 24, tags: ["dungeons:summoned_from_aura"] })
                if (minionsNearby.length >= 6) continue;
                var spawns = 2
                if (minionsNearby.length === 5) spawns = 1
                for (let i = 0; i < spawns; i++) {
                    var locSpawn = { x: loc.x + (Math.random() * 4 - Math.random() * 4), y: loc.y, z: loc.z + (Math.random() * 4 - Math.random() * 4) }
                    const topMost = dim.getTopmostBlock({ x: locSpawn.x, z: locSpawn.z }, locSpawn.y + 1)
                    if (topMost) locSpawn = topMost.above().bottomCenter()
                    var particleId = "dungeons:spawn_ancient_minion"
                    dim.spawnParticle(particleId, locSpawn)
                    system.runTimeout(() => {
                        if (!entity.isValid) return;
                        dim.playSound("ancient_mob.spawn", locSpawn)
                        system.runTimeout(() => {
                            if (!entity.isValid) return;
                            dim.spawnParticle(particleId + "_strike", locSpawn)
                            const mob = dim.spawnEntity(list[Math.floor(Math.random() * list.length)], loc, { initialPersistence: true })
                            mob.tryTeleport(locSpawn)
                            mob.addTag("dungeons:summoned_from_aura")
                            mob.addTag("dungeons:cannot_drop_soul")
                            dim.playSound('weapon.enchant.exploding', mob.location, {
                                pitch: 1.5
                            });
                        }, 30)
                    }, 2)
                }
            }
        }
    }
}, 100)