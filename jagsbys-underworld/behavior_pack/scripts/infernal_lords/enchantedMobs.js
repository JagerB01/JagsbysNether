import { DimensionTypes, MolangVariableMap } from "@minecraft/server";
import { world } from "./runtime.js";
import { scopedSystem } from "./runtime.js";
const system = scopedSystem("enchanted");


/* Enchanted Mob Rules (for the entity file)
    - 2x Health
    - "enchanted" mob family
    - 1.1x scale
    - + 0.2 knockback resistance
*/

function isEndersent(mob) {
    if (!mob.isValid) return false;
    if (mob.matches({ families: ["endersent"] })) return true;
    return false;
}

function addEndersentEnchants(mob) {
    if (mob.typeId.includes("savage")) mob.addTag("dungeons:enchanted_mob_frenzied")
    if (mob.typeId.includes("savage")) mob.addTag("dungeons:enchanted_mob_critical_hit")
    if (mob.typeId.includes("spiked")) mob.addTag("dungeons:enchanted_mob_sharpness")
    if (mob.typeId.includes("spiked")) mob.addTag("dungeons:enchanted_mob_thorns")
    if (mob.typeId.includes("ravenous")) mob.addTag("dungeons:enchanted_mob_committed")
    if (mob.typeId.includes("ravenous")) mob.addTag("dungeons:enchanted_mob_rampaging")
    if (mob.typeId.includes("blight")) mob.addTag("dungeons:enchanted_mob_poison_cloud")
    if (mob.typeId.includes("blight")) mob.addTag("dungeons:enchanted_mob_weakening")
    if (mob.typeId.includes("reaping")) mob.addTag("dungeons:enchanted_mob_shockwave")
    if (mob.typeId.includes("reaping")) mob.addTag("dungeons:enchanted_mob_electrified")
    if (mob.typeId.includes("binding")) mob.addTag("dungeons:enchanted_mob_chains")
    if (mob.typeId.includes("binding")) mob.addTag("dungeons:enchanted_mob_echo")
    if (mob.typeId.includes("binding")) mob.addTag("dungeons:enchanted_mob_fire_trail")


    if (mob.typeId.includes("binding")) {
        mob.setDynamicProperty("dungeons:enchant_count", 3)
    } else {
        mob.setDynamicProperty("dungeons:enchant_count", 2)

    }
}


const aquatic = [
    "minecraft:drowned",
    "dungeons:enchanted_drowned",
    "dungeons:sunken_skeleton",
    "dungeons:enchanted_sunken_skeleton"
]
const aquaticUnobtainable = [
    "fire_aspect",
    "burning",
    "fire_trail"
]

const explodies = [
    "minecraft:creeper",
    "dungeons:enchanted_creeper",
    "dungeons:icy_creeper",
    "dungeons:enchanted_icy_creeper"
]

const creeperUnobtainable = [
    "fire_aspect",
    "freezing",
    "poison_cloud",
    "radiance",
    "weakening"
]

const wraiths = [
    "minecraft:wraith",
    "dungeons:enchanted_wraith",
    "dungeons:tower_wraith",
    "dungeons:enchanted_tower_wraith"
]

const wraithUnobtainable = [
    "double_damage",
    "fire_aspect",
    "freezing",
    "poison_cloud",
    "radiance",
    "weakening"
]

const iceologers = [
    "minecraft:iceologer",
    "dungeons:enchanted_iceologer"
]

const iceologersUnobtainable = [
    "freezing",
    "poison_cloud",
    "radiance"
]

const petUnobtainable = [
    "burning",
    "chilling",
    "electrified",
    "fire_trail",
    "frenzied",
    "gravity_pulse",
    "heal_allies",
    "poison_cloud",
    "quick"
]

const ancientUnobtainableRandomly = [
    "electrified",
    "gravity_pulse",
    "heal_allies",
    "poison_cloud",
    "double_damage",
    "regeneration",
    "thorns",
    "protection"
]

const parched = [
    "minecraft:parched",
    "dungeons:enchanted_parched"
]

const parchedUnobtainable = [
    "weakening"
]

const easyDifficultyEnchants = [
    "burning",
    "chilling",
    "double_damage",
    "fire_aspect",
    "freezing",
    "frenzied",
    "heal_allies",
    "protection",
    "quick",
    "radiance",
    "rush",
    "thorns",
    "weakening"
]

const allEnchants = [
    "burning",
    "chilling",
    "double_damage",
    "electrified",
    "fire_aspect",
    "fire_trail",
    "freezing",
    "frenzied",
    "gravity_pulse",
    "heal_allies",
    "poison_cloud",
    "protection",
    "quick",
    "radiance",
    "regeneration",
    "rush",
    "thorns",
    "weakening"
]

//attack boost
world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (e.damageSource.cause == "override") return;
    if (damageSource.matches({ families: ["enchanted"], excludeFamilies: ["ancient"] })) {
        const cause = e.damageSource.cause
        if (cause == "lightning") return;
        e.damage = e.damage * 1.5
    }

});

//particles
system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ families: ["enchanted"], excludeFamilies: ["ancient", "ancient_minion"] })) {
            if (dim.isChunkLoaded(entity.location)) {
                if (entity.getEffect("invisibility")) continue;
                var enchantCount = 1
                if (entity.getDynamicProperty("dungeons:enchant_count") !== undefined) enchantCount = entity.getDynamicProperty("dungeons:enchant_count")
                const box = entity.getAABB()
                const h = Math.round(box.extent.y * 100) / 50
                const w = Math.round(box.extent.x * 100) / 50
                var map = new MolangVariableMap()

                map.setFloat("variable.radius", w)
                map.setFloat("variable.height", h)

                for (let i = 0; i < enchantCount; i++) {
                    if (world.getAbsoluteTime() % 4 == 0) dim.spawnParticle("dungeons:enchanted_sparks", entity.location, map)
                    dim.spawnParticle("dungeons:enchanted_smoke", entity.location)
                }
            }
        }
    }
})
//set enchant
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity.isValid) return;
    if (!entity.matches({ families: ["enchanted"] })) return;
    if (entity.hasTag("dungeons:enchanted")) return;
    entity.addTag("dungeons:enchanted")
    if (entity.matches({ families: ["ancient_minion"] })) return;
    var enchantsAvaliable = []
    if (isEndersent(entity)) {
        addEndersentEnchants(entity)
        return;
    }
    if (world.getDifficulty() == "Easy") {
        for (const enchant of easyDifficultyEnchants) {
            if (creeperUnobtainable.includes(enchant) && explodies.includes(entity.typeId)) continue;
            if (wraithUnobtainable.includes(enchant) && wraiths.includes(entity.typeId)) continue;
            if (aquaticUnobtainable.includes(enchant) && aquatic.includes(entity.typeId)) continue;
            if (iceologersUnobtainable.includes(enchant) && iceologers.includes(entity.typeId)) continue;
            if (parchedUnobtainable.includes(enchant) && parched.includes(entity.typeId)) continue;
            if (ancientUnobtainableRandomly.includes(enchant) && entity.matches({ families: ["ancient"] })) continue;
            enchantsAvaliable.push(enchant)
        }
    } else {
        for (const enchant of allEnchants) {
            if (creeperUnobtainable.includes(enchant) && explodies.includes(entity.typeId)) continue;
            if (wraithUnobtainable.includes(enchant) && wraiths.includes(entity.typeId)) continue;
            if (aquaticUnobtainable.includes(enchant) && aquatic.includes(entity.typeId)) continue;
            if (iceologersUnobtainable.includes(enchant) && iceologers.includes(entity.typeId)) continue;
            if (ancientUnobtainableRandomly.includes(enchant) && entity.matches({ families: ["ancient"] })) continue;
            enchantsAvaliable.push(enchant)
        }
    }
    var currentEnchants = 0
    var limited = false
    var maxEnchants = 3
    var rarityFactor = 0
    if (world.getDifficulty() == "Easy") maxEnchants = 1
    if (world.getDifficulty() == "Hard") rarityFactor = 1

    while (limited == false && currentEnchants < maxEnchants) {
        const rand = Math.floor(Math.random() * ((currentEnchants * 2) + 1))
        if (rand <= rarityFactor) {
            var random = Math.round(Math.random() * enchantsAvaliable.length - 1)
            if (random < 0) random = 0
            var selected = enchantsAvaliable[random]
            if (entity.hasTag("dungeons:enchanted_mob_" + selected) == false) {
                if (entity.matches({ families: ["ancient"] })) {
                    if (Math.random() < 0.2) {
                        entity.addTag("dungeons:enchanted_mob_" + selected)
                        currentEnchants += 1
                    } else {
                        limited = true;
                    }
                } else {
                    entity.addTag("dungeons:enchanted_mob_" + selected)
                    currentEnchants += 1
                }
            }
        } else {
            limited = true;
        }
    }
    if (entity.getDynamicProperty("dungeons:enchant_count")) currentEnchants += entity.getDynamicProperty("dungeons:enchant_count")
    entity.setDynamicProperty("dungeons:enchant_count", currentEnchants)
})

//HUD
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const equippable = player.getComponent("equippable")
        if (equippable) {
            if (equippable.getEquipment("Mainhand") && equippable.getEquipment("Mainhand").hasTag("mm:spell_caster")) continue;
        }
        const getLookAt = player.getEntitiesFromViewDirection({ maxDistance: 32, includePassableBlocks: true })
        var entity = undefined
        if (getLookAt.length == 0) continue;
        for (const mob of getLookAt) {
            if (entity) break;
            if (mob.entity.matches({ families: ["enchanted"], tags: ["dungeons:enchanted"] })) entity = mob.entity;
        }
        if (entity == undefined) continue;
        var text = ""
        for (const tag of entity.getTags()) if (tag.includes("dungeons:enchanted_mob_")) text += "|" + tag.replace("dungeons:enchanted_mob_", "")

        var raw = [{ text: "§e§n§c§h§d" }, { translate: entity.localizationKey }, { text: "\n" }]
        if (entity.matches({ families: ["ancient"] })) raw = [{ text: "§e§n§c§h§d" }, { text: "§g" }, { translate: entity.localizationKey }, { text: "\n" }]
        var count = 0
        for (const thing of text.split("|")) {
            if (thing.length == 0) continue;
            count += 1
            if (count == 4) raw.push({ text: "\n" })
            if (count == 7) raw.push({ text: "\n" })
            if (entity.matches({ families: ["ancient"] })) {
                raw.push({ text: "✦ §6" }, { translate: "enchanted_mob.desc." + thing }, { text: " " })
            } else if (entity.matches({ families: ["ancient_rider"] })) {
                raw.push({ text: "✦ §6" }, { translate: "enchanted_mob.desc." + thing }, { text: " " })
            } else {
                raw.push({ text: "✦ §u" }, { translate: "enchanted_mob.desc." + thing }, { text: " " })

            }
        }
        var display = { rawtext: raw }
        player.onScreenDisplay.setActionBar(display)
    }
})


//pets
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const id = e.eventId;
    if (id !== "dungeons:pet_become_enchanted") return
    const entity = e.entity;
    if (!entity.isValid) return;
    if (entity.hasTag("dungeons:enchanted")) return;
    entity.addTag("dungeons:enchanted")
    var enchantsAvaliable = []
    for (const enchant of allEnchants) {
        if (creeperUnobtainable.includes(enchant) && explodies.includes(entity.typeId)) continue;
        if (wraithUnobtainable.includes(enchant) && wraiths.includes(entity.typeId)) continue;
        if (aquaticUnobtainable.includes(enchant) && aquatic.includes(entity.typeId)) continue;
        if (iceologersUnobtainable.includes(enchant) && iceologers.includes(entity.typeId)) continue;
        if (petUnobtainable.includes(enchant)) continue;
        enchantsAvaliable.push(enchant)
    }
    var currentEnchants = 0
    var limited = false
    var maxEnchants = 1
    var rarityFactor = 0

    while (limited == false && currentEnchants < maxEnchants) {
        const rand = Math.floor(Math.random() * ((currentEnchants * 2) + 1))
        if (rand <= rarityFactor) {
            var random = Math.round(Math.random() * enchantsAvaliable.length - 1)
            if (random < 0) random = 0
            var selected = enchantsAvaliable[random]
            if (entity.hasTag("dungeons:enchanted_mob_" + selected) == false) {
                entity.addTag("dungeons:enchanted_mob_" + selected)
                currentEnchants += 1
            }
        } else {
            limited = true;
        }
    }
    entity.setDynamicProperty("dungeons:enchant_count", currentEnchants)
})


import "./enchantedMobs/doubleDamage.js";
import "./enchantedMobs/protection.js";
import "./enchantedMobs/quick.js";
import "./enchantedMobs/regeneration.js";
import "./enchantedMobs/burning.js";
import "./enchantedMobs/chilling.js";
import "./enchantedMobs/freezing.js";
import "./enchantedMobs/fireAspect.js";
import "./enchantedMobs/radiance.js";
import "./enchantedMobs/electrified.js";
import "./enchantedMobs/fireTrail.js";
import "./enchantedMobs/frenzied.js";
import "./enchantedMobs/gravityPulse.js";
import "./enchantedMobs/healAllies.js";
import "./enchantedMobs/poisonCloud.js";
import "./enchantedMobs/thorns.js";
import "./enchantedMobs/rush.js";
import "./enchantedMobs/weakening.js";

import "./enchantedMobs/criticalHit.js";
import "./enchantedMobs/sharpness.js";
import "./enchantedMobs/chains.js";
import "./enchantedMobs/committed.js";
import "./enchantedMobs/echo.js";
import "./enchantedMobs/shockwave.js";
import "./enchantedMobs/rampaging.js";

import "./enchantedMobs/resurrectionAura.js";
import "./enchantedMobs/leeching.js";
import "./enchantedMobs/swirling.js";
import "./enchantedMobs/growing.js";
import "./enchantedMobs/cowardice.js";
import "./enchantedMobs/multishot.js";
import "./enchantedMobs/mobSummon.js";
import "./enchantedMobs/fuseShot.js";
import "./enchantedMobs/accelerate.js";
import "./enchantedMobs/tempoTheft.js";