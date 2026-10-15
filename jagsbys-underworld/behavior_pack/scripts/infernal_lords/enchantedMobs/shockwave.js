import { EntityDamageCause } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "shockwave"

import { isValidTarget, getDirection, makeVector } from "../helpers.js"

function disableShield(hit) {
    hit.startItemCooldown("minecraft:shield", 50)
    const dim = hit.dimension;
    const targetLoc = hit.location;
    dim.playSound("random.break", targetLoc, { pitch: 0.6 })
    dim.spawnParticle("minecraft:critical_hit_emitter", { x: targetLoc.x, y: targetLoc.y + 0.4, z: targetLoc.z })
}

world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    const cause = e.damageSource.cause;
    if (cause !== "entityAttack") return;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        e.damage = e.damage * 1.1
        system.run(() => {
            const hurt = e.hurtEntity;
            if (!hurt) return;
            if (!hurt.isValid) return;
            const dim = hurt.dimension;
            const loc = hurt.location
            const damageRange = dim.getEntities({
                location: loc,
                maxDistance: 4,
                excludeFamilies: ['ignore']
            });
            for (const target of damageRange) {
                var damage = false
                if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                    if (target.matches({ families: ["monster"] })) continue;
                    var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)) * 2
                    damage = target.applyDamage(10 - distanceBetween, { cause: EntityDamageCause.entityAttack });
                    if (damage) {
                        if (target.typeId == "minecraft:player") {
                            target.runCommand("camerashake add @s 0.1 1.5")
                            target.runCommand("camerashake add @s 0.1 1")
                            target.runCommand("camerashake add @s 0.1 0.5")
                            target.runCommand("camerashake add @s 0.1 0.15")
                        }
                    }
                    const dir = getDirection(loc, target.location);
                    target.applyKnockback(makeVector(dir, 3), 0.5)
                    if (target.typeId == "minecraft:player") {
                        const isShieldReady = target.getItemCooldown("minecraft:shield")
                        if (isShieldReady > 0) continue;
                        if (target.isSneaking == false) continue;
                        const equippable = target.getComponent("equippable")
                        if (!equippable) continue;
                        const mainHand = equippable.getEquipment("Mainhand")
                        if (mainHand !== undefined) {
                            if (mainHand.typeId == "minecraft:shield") {
                                const dir = getDirection(loc, target.location);
                                if (!damage) target.applyKnockback(makeVector(dir, 1), 0.3)
                                disableShield(target)
                                continue;
                            }
                        }
                        const offhand = equippable.getEquipment("Offhand")
                        if (offhand !== undefined) {
                            if (offhand.typeId == "minecraft:shield") {
                                const dir = getDirection(loc, target.location);
                                if (!damage) target.applyKnockback(makeVector(dir, 1), 0.3)
                                disableShield(target)
                                continue;
                            }
                        }
                    }
                }
            }
        })
    }
});