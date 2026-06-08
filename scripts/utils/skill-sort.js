import { normalizeText } from "./normalization.js";

const SKILL_SORT_ORDER = Object.freeze([
  "Linguistics",
  "Zoology",
  "Botany",
  "Geology",
  "Industrial Equipment",
  "Jury-Rigging",
  "Chemistry",
  "Computers",
  "Zero-G",
  "Mathematics",
  "Art",
  "Archaeology",
  "Theology",
  "Military Training",
  "Rimwise",
  "Athletics",
  "Psychology",
  "Pathology",
  "Field Medicine",
  "Ecology",
  "Asteroid Mining",
  "Mechanical Repair",
  "Explosives",
  "Pharmacology",
  "Hacking",
  "Piloting",
  "Physics",
  "Mysticism",
  "Wilderness Survival",
  "Firearms",
  "Hand-to-Hand Combat",
  "Sophontology",
  "Exobiology",
  "Surgery",
  "Planetology",
  "Robotics",
  "Engineering",
  "Cybernetics",
  "Artificial Intelligence",
  "Hyperspace",
  "Xenoesotericism",
  "Command"
]);

const SKILL_RANK = new Map(SKILL_SORT_ORDER.map((name, index) => [normalizeText(name), index]));

function getSkillRank(name) {
  return SKILL_RANK.get(normalizeText(name)) ?? Number.MAX_SAFE_INTEGER;
}

export function compareSkillNames(a, b) {
  const rankA = getSkillRank(a);
  const rankB = getSkillRank(b);
  if (rankA !== rankB) return rankA - rankB;
  return String(a ?? "").localeCompare(String(b ?? ""));
}
