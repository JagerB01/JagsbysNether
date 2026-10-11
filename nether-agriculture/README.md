# Nether Agriculture — Bedrock crop port

Personal test build v0.1.5, separate from Nether Settlements. Based on the Nether
farming content in SuitedLlama's Agriculture Progression 1.0.1 for Java 1.16.4.
The original crop and item textures are included. End crops are excluded.

## Import and test

Import `../downloads/Nether_Agriculture_v0.1.5.mcaddon` into **Minecraft Bedrock
1.21.100 or newer**. Enable **Nether Agriculture Behavior** and **Nether Agriculture
Resources** on a disposable world with cheats enabled. Both packs are required.
The script uses stable `@minecraft/server` 2.0.0; Beta APIs are not required.
Replace the previous version with v0.1.5 and ensure both updated packs are active.
The pack has its own namespace and does not replace vanilla entity definitions,
loot tables, or the Nether Settlements pack.

In the Nether, run:

```mcfunction
/scriptevent jagsby_nether:kit
```

This gives the invoking player all four planting items, Wither Bone Meal,
Blistered Sorgum for recipe testing, soul soil, a hoe, shears, and a lava bucket.
It does not build a farm or change nearby terrain. See [TESTING.txt](TESTING.txt)
for the gameplay checklist.

## Farming

- Use a vanilla hoe on the top of soul soil in the Nether to make Soul Soil
  Farmland. Dry farmland stays tilled without lava, including after crops are
  harvested. Removing lava cools the plot but never turns it back into soul soil.
- Plant Sorgum Seeds, Polyps, or Grollet Seeds on dry or heated farmland. Dry and
  warming plots grow naturally at one third of the fully heated rate. Scarberry
  bushes keep their original lava-independent rate. All crops remain Nether-only.
- Optional lava within four blocks horizontally, at soil height or one block
  above, heats farmland in seven two-second steps while loaded. Full heat adds
  the glowing texture and growth-speed boost. Water and lava below soil do not
  heat it. Cooling after lava removal also takes seven steps.
- Sorgum and Polyps have eight stages; polyps use the original four texture stages.
  Wither Bone Meal works on dry and heated farmland and advances two to five
  stages without changing the soil's heat. Ordinary bone meal does not work.
- Sorgum at stage six on fully heated soil has a 1-in-475 mutation roll per random
  tick before its ordinary growth roll. Dry Sorgum grows without blistering.
  Harvest Blistered Sorgum by breaking the glowing crop.
- Break mature Sorgum for one Sorgum and zero to three seeds, using three independent
  4-in-7 seed rolls like ordinary wheat. Immature Sorgum returns one seed.
  Break mature Polyps for multiple polyps
  and a 2% chance of a Wither Polyp. Normal crop harvest uses breaking; these
  crops do not automatically replant themselves.
- Plant Scarberries on Nether ground or farmland. They grow without lava.
  Interact with stage-two or stage-three bushes to pick berries; the bush
  returns to stage one. Sneak to interact without picking. Wither Bone Meal
  advances one stage.
- Mature Grollet stems produce a gourd in an empty adjacent space with
  Nether ground underneath. Leave room around them. Removing the fruit lets
  the stem produce another. Use shears on a gourd for a carved gourd and four
  seeds; craft the carved gourd with a soul torch for a Grollet Lantern.

## Survival acquisition and recipes

Breaking Nether sprouts in survival retains their vanilla drops and adds the
original seed chances: 12.5% for Sorgum Seeds, otherwise a further 12.5% roll for
Grollet Seeds. Crimson roots have a 12.5% Scarberry drop, and warped roots a 12.5%
Polyp drop. These two acquisition drops substitute for the Java mod's natural
crop patches in this initial build. Wither skeletons add one to two Wither Bones.
One Wither Bone crafts into three Wither Bone Meal.

Original recipes are included for Sorgum Bread, Blistered Sorgum Bread, Scarberry
Bottles, Grollet Pie (gourd + redstone + egg), gourd seeds, Grollet Lanterns,
Sorgum bales, and Wither Bone Blocks. Polyps cook in furnaces, smokers, and campfires.
All crafting recipes are unlocked from the start. Disable the recipe book's
craftable-only filter to see recipes when ingredients are missing.
Scarberries can poison the eater; Scarberry Bottles remove Wither but can also
poison. Wither Polyps can cause Wither. Blistered Sorgum Bread grants sixteen
minutes of fire resistance. Food hunger/saturation values follow the Java mod.

## Scope and remaining gameplay checks

This is an initial crop test port. It does not include Blistered tools, custom
brewing/potions, End content, village integration, natural crop patch generation,
Java Fortune drop scaling, or the original bush contact damage and farmland
scorching/trampling mechanics. Crop planes and gourd timing are adapted for
Bedrock, rather than reproducing Java rendering and random ticks exactly.
Explosions use the ordinary Bedrock custom-block loot handling.

Automated checks exercise crop growth, lava range, mutation, fertilizer,
harvesting, adjacent gourds, deferred interactions, food effects and starter kits
with a mocked Bedrock API. Pack references and JS syntax are also checked.
These checks do not prove that Bedrock imports, renders or runs the pack;
live import, textures, loot, recipes, hunger effects and growth need in-game testing.
Version 0.1.1 restores the soul-soil sound group for farmland, adds a short arm
swing and the vanilla tilling sound, and adds bone-meal sound/growth particles to
successful fertilizer use. It avoids rewriting unchanged farmland states and
combines gourd attachment updates to reduce unnecessary block updates. Confirm
the arm swing in both first-person and third-person views, and retest stuttering.

## Development

All source definitions and imported textures live in `behavior_pack/` and
`resource_pack/`. No Java mod loader or npm installation is needed to rebuild:

```sh
cd /workspace/JagsbysNether/nether-agriculture
python3 tools/build.py
```

The builder validates pack references, runs the Node tests and writes the
versioned `.mcaddon` to the repository's `downloads/` directory. Archive entry
ordering and timestamps are fixed so repeated builds are reproducible.

Original creator and source metadata are recorded in [CREDITS.txt](CREDITS.txt),
[SOURCE_METADATA.json](SOURCE_METADATA.json), and
[ORIGINAL_LICENSE.txt](ORIGINAL_LICENSE.txt).

Version 0.1.2 renames displayed Rye content to Sorgum and Murky Gourd content
to Grollet (including seeds, bread, pie, bales, stems and decorations). Internal
identifiers keep their original spelling so existing blocks, inventories and
recipes continue working in worlds upgraded from v0.1.0 or v0.1.1.

Version 0.1.3 adds delayed farmland heating/cooling, separates coplanar crop
faces into very thin planes to address visual flicker, and animates both the
arm and first-person held-item bone for tilling/fertilizer. The animation no
longer uses an explicit stop expression that could terminate it prematurely.
These visual changes require another in-game check in both camera views.

Version 0.1.4 allows Wither Bone Meal on dry/warming farmland without changing
its heat level. Natural growth still requires fully heated soil. Farming
interactions are no longer cancelled, and the swing animation also drives the
native player attack-time variable. Arm/held-item motion is experimental and
requires first-person and third-person testing on Bedrock 26.52; previous
bone-only animation attempts did not work in the reported game tests.

Version 0.1.5 keeps unheated farmland tilled permanently and permits natural crop
and Grollet fruit growth without lava. Fully heated soil retains the existing
rate; dry/warming soil is three times slower. This intentionally changes the
Java mod's heat requirement at the user's request. Blistered Sorgum mutation
still needs fully heated soil.

Fertilizer now uses the custom crop's native `onPlayerInteract` handler. The
ineffective scripted arm animation and attack-time variable workaround were
removed after in-game tests reported no motion. Fertilizer arm motion requires
another live check; vanilla-hoe tilling motion remains unresolved. The current
stable and preview Script APIs have no direct arm-swing method. No player or
vanilla hoe definitions are overridden.
