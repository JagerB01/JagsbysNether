import { EntityDamageCause } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "swirling"

import { isValidTarget, getDirection, makeVector } from "../helpers.js"

function disableShield(hit) {
    hit.startItemCooldown("minecraft:shield", 20)
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
        e.damage = e.damage * 1.3
        system.run(() => {
            const dim = damageSource.dimension;
            const loc = damageSource.location
            const damageRange = dim.getEntities({
                location: loc,
                maxDistance: 4,
                excludeFamilies: ['ignore']
            });
            for (const target of damageRange) {
                var damage = false
                if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                    if (target.matches({ families: ["monster"] })) continue;
                    const didDamage = target.applyDamage(e.damage * 0.77, { cause: EntityDamageCause.entityAttack });
                    if (damage == false) damage = didDamage
                    const dir = getDirection(loc, target.location);
                    target.applyKnockback(makeVector(dir, 1), 0.6)
                    if (target.typeId == "minecraft:player") {
                        const isShieldReady = target.getItemCooldown("minecraft:shield")
                        if (isShieldReady > 0) continue;
                        if (target.isSneaking == false) continue;
                        const equippable = target.getComponent("equippable")
                        if (!equippable) continue;
                        const mainHand = equippable.getEquipment("Mainhand")
                        if (mainHand !== undefined) {
                            if (mainHand.typeId == "minecraft:shield") {
                                if (!damage) target.applyKnockback(makeVector(dir, 1), 0.6)
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
            if (e.damage > 0 || damage) {
                dim.spawnParticle("dungeons:swirling", { x: loc.x, y: loc.y + 1, z: loc.z })
                dim.playSound("weapon.enchant.swirling", loc)
            }
        })
    }
});