import { normalizeNumber, normalizeText, stripHtml } from "../utils/normalization.js";
export const toSkillId = value => String(value ?? "").split(".").pop();

export { normalizeText, stripHtml };

export function toNumberOrZero(value) {
  if (value === "" || value === null || value === undefined) return 0;
  return normalizeNumber(value, { fallback: 0 });
}

/**
 * Resolve a class skill-selection source into the trained/expert/master point bundle.
 *
 * Full-set fields include all lower tiers required for that rank: `expert_full_set` grants
 * one trained and one expert point, while `master_full_set` grants one trained, one
 * expert, and one master point.
 */
export function toSkillSelectionPointBundle(source = {}) {
  return {
    trained: toNumberOrZero(source.trained) + toNumberOrZero(source.expert_full_set) + toNumberOrZero(source.master_full_set),
    expert: toNumberOrZero(source.expert) + toNumberOrZero(source.expert_full_set) + toNumberOrZero(source.master_full_set),
    master: toNumberOrZero(source.master) + toNumberOrZero(source.master_full_set)
  };
}
