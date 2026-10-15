import { EntityDamageCause } from "@minecraft/server";
import { isImported } from "./runtime.js";
import { world } from "./runtime.js";
import { scopedSystem } from "./runtime.js";
const system = scopedSystem("actors");


world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
    const player = e.player;
    const block = e.block;
    if (player.getGameMode() == "Creative") return;
    if (world.getDifficulty() == "Peaceful") return;
    const bosses = player.dimension.getEntities({ families: ["boss"], location: block.location, maxDistance: 64 })
    if (bosses.some(isImported) && block.typeId === "minecraft:bed") {
        player.sendMessage({ rawtext: [{ text: "§7" }, { translate: "dungeons.warn.boss_nearby" }] })
        e.cancel = true;
        return;

    }
});

world.afterEvents.entityDie.subscribe((e) => {
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    const dead = e.deadEntity;
    if (!dead) return;
    if (!dead.isValid) return;
    if (!dead.matches({ families: ["player"] })) return;

    if (attacker.matches({ families: ["boss"] })) {
        for (let i = 0; i < 50; i++) {
            system.runTimeout(() => {
                if (attacker.isValid == false) return;
                let hp = attacker.getComponent('minecraft:health');
                const healAmt = hp.defaultValue * 0.05
                if (hp.currentValue == hp.defaultValue) return;
                if (hp.currentValue > hp.defaultValue - (healAmt / 50)) {
                    hp.setCurrentValue(hp.defaultValue)
                } else {
                    hp.setCurrentValue(hp.currentValue + (healAmt / 50))
                }
            }, i)
        }

    }

});

//ignore protection

const ignoresArmour = [
    EntityDamageCause.override,
    EntityDamageCause.selfDestruct,
    EntityDamageCause.sonicBoom,
    EntityDamageCause.fall,
    EntityDamageCause.fireTick,
    EntityDamageCause.suffocation,
    EntityDamageCause.drowning,
    EntityDamageCause.starve,
    EntityDamageCause.flyIntoWall,
    EntityDamageCause.magic,
    EntityDamageCause.void,
    EntityDamageCause.freezing
]

function getProtLevel(item) {
    if (!item) return 0
    const enchantable = item.getComponent("enchantable")
    if (!enchantable) return 0
    const protection = enchantable.getEnchantment("protection")
    if (!protection) return 0
    return protection.level
}

world.beforeEvents.entityHurt.subscribe((e) => {
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    const baseDamage = e.damage;
    if (attacker.typeId.includes("dungeons") && attacker.matches({ families: ["boss"] })) {
        const equippable = hurt.getComponent("equippable")
        var protection = 0
        protection += getProtLevel(equippable.getEquipment("Head"))
        protection += getProtLevel(equippable.getEquipment("Chest"))
        protection += getProtLevel(equippable.getEquipment("Legs"))
        protection += getProtLevel(equippable.getEquipment("Feet"))
        var reduction = 12
        if (world.getDifficulty() == "Easy") reduction = 20
        if (world.getDifficulty() == "Normal") reduction = 16
        var mult = 1
        if(ignoresArmour.includes(e.damageSource.cause)) mult = 0.3
        e.damage = e.damage * Math.min(1, 1 + (protection / reduction))
        e.damage = Math.max(baseDamage, e.damage*mult)
        e.damage = Math.min(baseDamage*2, e.damage)
    }
})