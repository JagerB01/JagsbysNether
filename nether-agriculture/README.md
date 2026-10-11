# Nether Agriculture — Bedrock crop port

Personal test build v0.1.0, separate from Nether Settlements. Based on the Nether
farming content in SuitedLlama's Agriculture Progression 1.0.1 for Java 1.16.4.
The original crop and item textures are included. End crops are excluded.

## Import and test

Import `../downloads/Nether_Agriculture_v0.1.0.mcaddon` into **Minecraft Bedrock
1.21.100 or newer**. Enable **Nether Agriculture Behavior** and **Nether Agriculture
Resources** on a disposable world with cheats enabled. Both packs are required.
The script uses stable `@minecraft/server` 2.0.0; Beta APIs are not required.
The pack has its own namespace and does not replace vanilla entity definitions,
loot tables, or the Nether Settlements pack.

In the Nether, run:

```mcfunction
/scriptevent jagsby_nether:kit
```

This gives the invoking player all four planting items, Wither Bone Meal,
Blistered Rye for recipe testing, soul soil, a hoe, shears, and a lava bucket.
It does not build a farm or change nearby terrain. See [TESTING.txt](TESTING.txt)
for the gameplay checklist.

## Farming

- Use a vanilla hoe on the top of soul soil to make Soul Soil Farmland.
  Lava must be within four blocks horizontally, at the farmland's height or one
  block above it. Water and lava below the soil do not heat it. Heated farmland
  glows faintly; unheated farmland eventually returns to soul soil.
- Plant Rye Seeds, Polyps, or Murky Seeds on Soul Soil Farmland. They only grow
  on heated farmland in the Nether. Rye and Polyps have eight stages; polyps
  use the original four texture stages. Wither Bone Meal advances two to five
  stages. Ordinary bone meal does not fertilize these crops.
- Rye at stage six has a 1-in-475 mutation roll per random tick before its
  ordinary growth roll. Harvest Blistered Rye by breaking the glowing crop.
- Break mature Rye for rye and seeds. Break mature Polyps for multiple polyps
  and a 2% chance of a Wither Polyp. Normal crop harvest uses breaking; these
  crops do not automatically replant themselves.
- Plant Scarberries on Nether ground or farmland. They grow without lava.
  Interact with stage-two or stage-three bushes to pick berries; the bush
  returns to stage one. Sneak to interact without picking. Wither Bone Meal
  advances one stage.
- Mature Murky Gourd stems produce a gourd in an empty adjacent space with
  Nether ground underneath. Leave room around them. Removing the fruit lets
  the stem produce another. Use shears on a gourd for a carved gourd and four
  seeds; craft the carved gourd with a soul torch for a Murk O' Lantern.

## Survival acquisition and recipes

Breaking Nether sprouts in survival retains their vanilla drops and adds the
original seed chances: 12.5% for Rye Seeds, otherwise a further 12.5% roll for
Murky Seeds. Crimson roots have a 12.5% Scarberry drop, and warped roots a 12.5%
Polyp drop. These two acquisition drops substitute for the Java mod's natural
crop patches in this initial build. Wither skeletons add one to two Wither Bones.
One Wither Bone crafts into three Wither Bone Meal.

Original recipes are included for Rye Bread, Blistered Rye Bread, Scarberry
Bottles, Murky Pie (gourd + redstone + egg), gourd seeds, Murk O' Lanterns,
rye bales, and Wither Bone Blocks. Polyps cook in furnaces, smokers, and campfires.
Scarberries can poison the eater; Scarberry Bottles remove Wither but can also
poison. Wither Polyps can cause Wither. Blistered Rye Bread grants sixteen
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
