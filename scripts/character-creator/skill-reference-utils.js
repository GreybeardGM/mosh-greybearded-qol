import { normalizeText, toSkillId } from "./utils.js";

function getRawSkillReference(reference) {
  return typeof reference === "string" ? reference : reference?.uuid || reference?.id;
}

function toSkillReferenceSummary(skill, { includeRank = false } = {}) {
  const summary = {
    id: skill.id,
    uuid: skill.uuid,
    name: skill.name,
    img: skill.img || "icons/svg/d20-grey.svg"
  };

  if (includeRank) summary.rank = normalizeText(skill?.system?.rank);

  return summary;
}

export function resolveSkillReferences(references, { skillByUuid, skillMap, includeRank = false, onMissing = null } = {}) {
  const candidates = Array.isArray(references) ? references : [];
  const unique = new Map();

  for (const reference of candidates) {
    const rawRef = getRawSkillReference(reference);
    if (!rawRef) continue;

    const skill = skillByUuid?.get(rawRef) || skillMap?.get(toSkillId(rawRef));
    if (!skill) {
      if (typeof onMissing === "function") onMissing(rawRef, reference);
      continue;
    }

    unique.set(skill.id, toSkillReferenceSummary(skill, { includeRank }));
  }

  return [...unique.values()];
}
