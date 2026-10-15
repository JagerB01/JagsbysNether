import { world } from "../runtime.js";


const id = "leeching"

world.afterEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const hp = damageSource.getComponent("health")
        if (hp.currentValue + e.damage / 4 <= hp.defaultValue) {
            hp.setCurrentValue(hp.currentValue + e.damage / 4)
        } else {
            hp.setCurrentValue(hp.defaultValue)
        }

    }
});