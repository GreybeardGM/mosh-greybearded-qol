import { getSkillSortOrder } from "../codex/skill-sort.js";
import { normalizeNumber, normalizeText, stripHtml } from "../utils/normalization.js";
export { getSkillSortOrder };

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
