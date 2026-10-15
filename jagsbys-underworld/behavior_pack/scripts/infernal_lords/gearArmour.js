import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:toughness', {});
});

const doNotReduce = [
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

const maxToughnessReduction = 0.80;
const damageScale = 9;
const offset = 7

function customToughness(damage, toughness) {
    const toughnessFactor = toughness / (toughness + offset);
    const damageFactor = damage / (damage + damageScale);
    const toughnessReduction = maxToughnessReduction*toughnessFactor *damageFactor;
    var finalDamage = damage * (1 - (toughnessReduction*1.5))
    return finalDamage;
}

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if(!hurt || !hurt.isValid || hurt.typeId !== "minecraft:player") return;
    const equippable = hurt.getComponent("equippable")
    if(!equippable) return;
    const cause = e.damageSource.cause
    if(doNotReduce.includes(cause)) return;
    var bonusToughness = 0
    const slots = [
        "Head",
        "Chest",
        "Legs",
        "Feet"
    ]
    for(const slot of slots) {
        const slotItem = equippable.getEquipment(slot)
        if(slotItem) {
            const toughComp = slotItem.getComponent("dungeons:toughness")
            if(toughComp) {
                bonusToughness += toughComp.customComponentParameters.params.toughness
            }
        }
    }
    if(bonusToughness == 0) return;
    const damage = e.damage
    e.damage = customToughness(damage,  bonusToughness)
})










//imports
