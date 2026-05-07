import { normalizeNumber, normalizeText, stripHtml } from "../utils/normalization.js";

export function getSkillSortOrder() {
  return [
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
  ];
}

export const toSkillId = value => String(value ?? "").split(".").pop();

export { normalizeText, stripHtml };

export function toNumberOrZero(value) {
  if (value === "" || value === null || value === undefined) return 0;
  return normalizeNumber(value, { fallback: 0 });
}

export function toSkillPointBundle(source = {}) {
  return {
    trained: toNumberOrZero(source.trained) + toNumberOrZero(source.expert_full_set) + toNumberOrZero(source.master_full_set),
    expert: toNumberOrZero(source.expert) + toNumberOrZero(source.expert_full_set) + toNumberOrZero(source.master_full_set),
    master: toNumberOrZero(source.master) + toNumberOrZero(source.master_full_set)
  };
}

export function sumSkillPointFields(...values) {
  return values.reduce((sum, value) => sum + toNumberOrZero(value), 0);
}
