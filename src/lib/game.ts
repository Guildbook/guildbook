export const CLASSES = [
  "warrior",
  "paladin",
  "hunter",
  "rogue",
  "priest",
  "shaman",
  "mage",
  "warlock",
  "druid",
] as const;
export type WowClass = (typeof CLASSES)[number];

export const CLASS_INFO: Record<WowClass, { label: string; color: string; specs: readonly string[] }> = {
  warrior: { label: "Warrior", color: "#C69B6D", specs: ["Arms", "Fury", "Protection"] },
  paladin: { label: "Paladin", color: "#F48CBA", specs: ["Holy", "Protection", "Retribution"] },
  hunter: { label: "Hunter", color: "#AAD372", specs: ["Beast Mastery", "Marksmanship", "Survival"] },
  rogue: { label: "Rogue", color: "#FFF468", specs: ["Assassination", "Combat", "Subtlety"] },
  priest: { label: "Priest", color: "#FFFFFF", specs: ["Discipline", "Holy", "Shadow"] },
  shaman: { label: "Shaman", color: "#0070DD", specs: ["Elemental", "Enhancement", "Restoration"] },
  mage: { label: "Mage", color: "#3FC7EB", specs: ["Arcane", "Fire", "Frost"] },
  warlock: { label: "Warlock", color: "#8788EE", specs: ["Affliction", "Demonology", "Destruction"] },
  druid: { label: "Druid", color: "#FF7C0A", specs: ["Balance", "Feral", "Restoration"] },
};

export function isValidSpec(wowClass: WowClass, spec: string): boolean {
  return CLASS_INFO[wowClass].specs.includes(spec);
}

export const ROLES = ["tank", "healer", "melee", "ranged"] as const;
export type RaidRole = (typeof ROLES)[number];
export const ROLE_LABELS: Record<RaidRole, string> = {
  tank: "Tank",
  healer: "Healer",
  melee: "Melee DPS",
  ranged: "Ranged DPS",
};

export const fullName = (name: string, surname: string) => `${name} ${surname}`;

export const FACTIONS = ["alliance", "horde"] as const;
export type Faction = (typeof FACTIONS)[number];
export const FACTION_LABELS: Record<Faction, string> = { alliance: "Alliance", horde: "Horde" };

export const PROFESSIONS = [
  "alchemy",
  "blacksmithing",
  "enchanting",
  "engineering",
  "herbalism",
  "leatherworking",
  "mining",
  "skinning",
  "tailoring",
  "cooking",
  "first_aid",
  "fishing",
] as const;
export type Profession = (typeof PROFESSIONS)[number];
export const PROFESSION_LABELS: Record<Profession, string> = {
  alchemy: "Alchemy",
  blacksmithing: "Blacksmithing",
  enchanting: "Enchanting",
  engineering: "Engineering",
  herbalism: "Herbalism",
  leatherworking: "Leatherworking",
  mining: "Mining",
  skinning: "Skinning",
  tailoring: "Tailoring",
  cooking: "Cooking",
  first_aid: "First Aid",
  fishing: "Fishing",
};

export const MAX_LEVEL = 60;
export const MAX_PROFESSION_SKILL = 300;
export const MAX_IN_GAME_RANKS = 10;

/** World of Warcraft: Forever launch day (a Wednesday). Nothing happens in game before this date. */
export const WOWF_LAUNCH_DATE = "2026-11-04";

export const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
