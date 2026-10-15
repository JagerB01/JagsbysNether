import { DimensionTypes } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "multishot"


//projectiles
function multiply(a, b) {
    return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    if (entity.hasTag("dungeons:chud_projectile")) return;
    const cause = e.cause;
    if (cause !== "Spawned") return;
    const proj = entity.getComponent("projectile")
    if (!proj) return;
    const owner = proj.owner;
    if (!owner) return;
    if (!owner.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) return;
    const dim = owner.dimension;
    const viewDir = owner.getViewDirection()
    let amount = 5
    for (let i = 0; i < amount; i++) {
        const angle = -((amount - 1) / 2 * 10) + 10 * i;
        const radians = angle * (Math.PI / 180)
        //if (angle == 0) continue;
        const hd = { x: owner.location.x, y: entity.location.y, z: owner.location.z }
        const vd = owner.getViewDirection();
        const projectile = dim.spawnEntity(entity.typeId, { x: hd.x + vd.x, y: hd.y + vd.y, z: vd.z + hd.z })
        const comp = projectile.getComponent('projectile');
        let cosTheta = Math.cos(radians);
        let sinTheta = Math.sin(radians);
        const direction = {
            x: viewDir.x * cosTheta + viewDir.z * sinTheta,
            y: viewDir.y,
            z: -viewDir.x * sinTheta + viewDir.z * cosTheta
        }
        if (comp) {
            comp.owner = owner
            comp.shoot(multiply(direction, { x: 1.4, y: 1.4, z: 1.4 }))
        } else {
            projectile.applyImpulse(multiply(direction, { x: 1.4, y: 1.4, z: 1.4 }))
        }
        projectile.addTag("dungeons:chud_projectile")
    }
    entity.remove()
})