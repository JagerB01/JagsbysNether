import { MolangVariableMap, EntityDamageCause } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const particleSpeed = 10
const id = "resurrection_aura"

world.afterEvents.entityDie.subscribe((e) => {
    const entity = e.deadEntity;
    if (!entity.isValid) return;
    if (!entity.matches({ families: ["enchanted", "monster"], excludeFamilies: ["ancient", "boss"] })) return
    attemptRevive(entity)
})

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    if (e.eventId !== "dungeons:before_exploding") return;
    const entity = e.entity;
    if (!entity || !entity.isValid || !entity.matches({ families: ["creeper", "enchanted", "monster"] })) return
    const type = entity.typeId;
    const tags = entity.getTags();
    const name = entity.nameTag;
    const dim = entity.dimension;
    const loc = entity.location;
    system.runTimeout(() => {
        if (entity.isValid) return;
        attemptRevive(entity, type, tags, name, dim, loc)
    }, 2)
})

function attemptRevive(entity, typeId, tags, name, dim, loc) {
    if (!typeId) typeId = entity.typeId;
    if (!tags) tags = entity.getTags()
    if (!name && entity.isValid) name = entity.nameTag;
    if (!dim) dim = entity.dimension;
    if (!loc) loc = entity.location
    system.runTimeout(() => {
        if (dim.isChunkLoaded(loc) == false) return;
        const findReviver = dim.getEntities({ maxDistance: 32, location: loc, tags: ["dungeons:enchanted_mob_" + id] })
        if (findReviver.length == 0) return;
        const reviver = findReviver[0]
        for (let i = 0; i < 15; i++) {
            system.runTimeout(() => {
                if (!reviver.isValid) return;
                var eLoc = reviver.location;
                eLoc = { x: eLoc.x, y: eLoc.y + 1, z: eLoc.z }
                var tLoc = loc;
                tLoc = { x: tLoc.x, y: tLoc.y + 1, z: tLoc.z }
                var dx = tLoc.x - eLoc.x
                var dy = tLoc.y - eLoc.y
                var dz = tLoc.z - eLoc.z
                const length = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2))

                dx = dx / length
                dy = dy / length
                dz = dz / length

                const lifetime = length / particleSpeed

                var map = new MolangVariableMap()
                map.setColorRGB("variable.color", { red: 1, green: 1, blue: 0 })
                map.setFloat("variable.particle_initial_speed", particleSpeed)
                map.setFloat("variable.max_lifetime", lifetime)
                map.setVector3("variable.direction", { x: dx, y: dy, z: dz })

                var xOffset = Math.random() * 0.2 - 0.1
                var yOffset = Math.random() * 0.2 - 0.1
                var zOffset = Math.random() * 0.2 - 0.1
                if (dim.isChunkLoaded(eLoc)) dim.spawnParticle("minecraft:creaking_heart_trail", { x: eLoc.x + xOffset, y: eLoc.y + yOffset, z: eLoc.z + zOffset }, map)
                if (i == 0) {
                    system.runTimeout(() => {
                        dim.spawnParticle("dungeons:radiance_aura2", tLoc)
                        const newEntity = dim.spawnEntity(typeId, loc)
                        for (const tag of tags) newEntity.addTag(tag)
                        newEntity.addTag("dungeons:cannot_drop_soul")
                        if (name) newEntity.nameTag = name
                    }, Math.round(lifetime * 20))
                }
            }, i / 2)
        }
    }, 200)
}