import { MolangVariableMap } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "heal_allies"

const particleSpeed = 12

function heal(entity, amt) {
    if (!entity.isValid) return;
    const hp = entity.getComponent("health")
    const max = hp.defaultValue
    const current = hp.currentValue
    if (current + amt >= max) {
        hp.setCurrentValue(max)
    } else {
        hp.setCurrentValue(current + amt)
    }
}

world.afterEvents.entityHurt.subscribe((e) => {
    const hurtEntity = e.hurtEntity;
    if (!hurtEntity) return;
    if (!hurtEntity.isValid) return;
    if (hurtEntity.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const amtHealed = e.damage * 0.75;
        const dim = hurtEntity.dimension;
        var loc = hurtEntity.location;
        loc = { x: loc.x, y: loc.y + 1, z: loc.z }
        const targets = dim.getEntities({ maxDistance: 8, location: loc, families: ["monster"] })
        for (const target of targets) {
            if (target == hurtEntity) continue;
            const hp = target.getComponent("health")
            if (hp && hp.currentValue >= hp.defaultValue) continue;
            system.runTimeout(() => {
                for (let i = 0; i < 10; i++) {
                    system.runTimeout(() => {
                        if (!hurtEntity.isValid || !target.isValid) return;
                        var eLoc = hurtEntity.location;
                        eLoc = { x: eLoc.x, y: eLoc.y + 1, z: eLoc.z }
                        var tLoc = target.location;
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
                        try {
                            map.setVector3("variable.direction", { x: dx, y: dy, z: dz })
                        } catch {
                            return;
                        }

                        var xOffset = Math.random() * 0.2 - 0.1
                        var yOffset = Math.random() * 0.2 - 0.1
                        var zOffset = Math.random() * 0.2 - 0.1
                        if (dim.isChunkLoaded(eLoc)) dim.spawnParticle("minecraft:creaking_heart_trail", { x: eLoc.x + xOffset, y: eLoc.y + yOffset, z: eLoc.z + zOffset }, map)
                        if (i == 0) {
                            system.runTimeout(() => {
                                if (!hurtEntity.isValid || !target.isValid) return;
                                heal(target, amtHealed)
                                dim.spawnParticle("dungeons:radiance_aura2", tLoc)
                            }, Math.round(lifetime * 20))
                        }
                    }, i / 2)
                }
            }, targets.indexOf(target))
        }
    }
});