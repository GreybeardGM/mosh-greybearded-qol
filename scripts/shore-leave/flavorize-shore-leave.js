import { SHORE_LEAVE_ACTIVITIES } from "./default-shore-leave-activities.js";

/**
 * Adds random flavor (label, description, icon) to the given shore leave tier.
 * @param {Object} tier - The base tier object to modify.
 * @returns {Object} The same tier object, extended with a `flavor` field.
 */
export function flavorizeShoreLeave(tier) {
  const activities = SHORE_LEAVE_ACTIVITIES.flatMap(group => group.activities);
  const matches = activities.filter(a => a.tier === tier.tier);

  if (matches.length === 0) return tier;

  const selected = matches[Math.floor(Math.random() * matches.length)];

  tier.flavor = {
    label: selected.label,
    description: selected.description,
    icon: selected.icon ?? null
  };

  return tier;
}
