import {
    world,
    system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent("dungeons:durability_fix", {
        onBeforeDurabilityDamage(e) {
            if (e.durabilityDamage == 2) e.durabilityDamage -= 1
            const enchantable = e.itemStack.getComponent("enchantable")
            if (enchantable) {
                var chance = 1
                const unbreaking = enchantable.getEnchantment("unbreaking")
                if (unbreaking) {
                    chance = 1 / (unbreaking.level + 1)
                }
                if (Math.random() > chance) e.durabilityDamage = 0;
            }
        },
        onMineBlock(e, p) {
            const tagToBreak = p.params.tag
            var item = e.itemStack;
            const player = e.source
            if (player.getGameMode() == "Creative") return;
            const equipment = player.getComponent("minecraft:equippable")
            const block = e.minedBlockPermutation;
            var chance = 1
            const enchantable = item.getComponent("enchantable")
            if (enchantable) {

                const unbreaking = enchantable.getEnchantment("unbreaking")
                if (unbreaking) {
                    chance = 1 / (unbreaking.level + 1)
                }
                if (Math.random() > chance) return;
            }
            var duraDamage = 0

            if (block.hasTag(tagToBreak)) {
                duraDamage = 1
            } else {
                duraDamage = 2
            }
            const durability = item.getComponent("minecraft:durability")
            if (!durability) return;

            if (durability.damage + duraDamage < durability.maxDurability) {
                durability.damage += duraDamage;
                equipment.setEquipment("Mainhand", item)
            } else {
                equipment.setEquipment("Mainhand", undefined)
                player.dimension.playSound("random.break", player.location, { volume: 1, pitch: 1 })

            }

        }
    })
})
