"""Patch only MineScape's primary perk calculation; retain its pack UUID/data."""
import argparse,hashlib,json,sys,zipfile
from pathlib import Path
from build import archive_files
ROOT=Path(__file__).resolve().parents[1]
def patch_perks(source):
 old='export function skillPerkPercent(player, skill) {\n  return skillPerkTier(player, skill);\n}'
 new='export function skillPerkPercent(player, skill) {\n  return skillPerkTier(player, skill) * underworldFoodBuffMultiplier(player, skill);\n}'
 assert source.count(old)==1,'Unsupported MineScape perk implementation'
 source='import { system } from "@minecraft/server";\nimport { underworldFoodBuffMultiplier, refreshUnderworldFoodBuff } from "./underworld_food_buffs.js";\n'+source.replace(old,new)
 assert source.count('    percent: tier,')==1 and source.count('    chance: tier / 100,')==1
 source=source.replace('    percent: tier,','    percent: skillPerkPercent(player, skill),').replace('    chance: tier / 100,','    chance: skillPerkChance(player, skill),')
 source+='''
// On-demand diagnostics; no recurring timer or XP/level changes.
system.afterEvents.scriptEventReceive.subscribe(({id,sourceEntity:player})=>{
 if(id!=="passiveskills:food_buff_status"||player?.typeId!=="minecraft:player")return;
 refreshUnderworldFoodBuff(player);
 player.sendMessage(SKILLS.map(([skill,name])=>`${name}: ${skillPerkTier(player,skill)}% base → ${skillPerkPercent(player,skill)}% active`).join("\\n"));
});
'''
 return source

def main():
 ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);args=ap.parse_args()
 with zipfile.ZipFile(args.source) as z:
  entries={n[3:]:z.read(n) for n in z.namelist() if n.startswith('BP/') and not n.endswith('/')}
 assert entries,'MineScape BP folder missing';original=dict(entries)
 manifest=json.loads(entries['manifest.json']);assert manifest['header']['uuid']=='b3d0b980-7d84-483f-857e-41c763f8695d'
 assert manifest['header']['version']==[1,5,18],'Patch requires the supplied MineScape v1.5.18'
 entries['scripts/perks.js']=patch_perks(entries['scripts/perks.js'].decode()).encode()
 entries['scripts/underworld_food_buffs.js']=(ROOT/'compatibility/minescape/underworld_food_buffs.js').read_bytes()
 entries['scripts/underworld_food_buff_state.js']=(ROOT/'behavior_pack/scripts/food_buffs/state.js').read_bytes()
 manifest['header']['name']='MineScape v1.5.18 + Underworld Food Buffs'
 manifest['header']['description']='MineScape v1.5.18 compatibility: timed Underworld food doubles selected primary passive bonuses. Existing skills, levels, XP, relics and UUID are retained.'
 manifest['header']['version']=[1,5,19]
 for module in manifest['modules']:module['version']=[1,5,19]
 entries['manifest.json']=(json.dumps(manifest,indent=2)+'\n').encode()
 changed=['manifest.json','scripts/perks.js']
 for name,content in original.items():
  if name not in changed:assert entries[name]==content,name
 notes={'source_sha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),'base_version':'1.5.18','import_version':[1,5,19],'header_uuid_retained':manifest['header']['uuid'],'changed_original_files':changed,'added_scripts':['scripts/underworld_food_buffs.js','scripts/underworld_food_buff_state.js'],'scope':'primary percentage perks only; secondary perks, XP and skill tiers unchanged','resource_pack':'existing MineScape 1.5.18 RP retained; original dependency unchanged'}
 entries['docs/UNDERWORLD_FOOD_BUFFS.json']=(json.dumps(notes,indent=2)+'\n').encode()
 entries['docs/UNDERWORLD_FOOD_BUFFS.md']=(ROOT/'FOOD_BUFFS.md').read_bytes()
 out=ROOT.parent/'downloads/MineScape_v1.5.18_Underworld_Food_Buffs.mcpack';out.write_bytes(archive_files(entries.items()))
 (ROOT/'compatibility/minescape/PATCH_METADATA.json').write_text(json.dumps(notes,indent=2)+'\n')
 print(f'Built {out}; preserved {len(original)-len(changed)} original MineScape BP files byte-for-byte')
if __name__=='__main__':main()
