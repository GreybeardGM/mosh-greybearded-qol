import { SHORE_LEAVE_ACTIVITIES } from "../config/default-shore-leave-activities.js";

/**
 * Enhances a shore leave tier with random flavor based on tier.
 * @param {Object} tier - The base tier object to flavorize.
 * @returns {Object} Tier object with .flavor.{label, description, icon}
 */
export function flavorizeShoreLeave(tier) {
  const activities = SHORE_LEAVE_ACTIVITIES.flatMap(group => group.activities);
  const matches = activities.filter(a => a.tier === tier.tier);

  if (matches.length === 0) return {};

  const activity = matches[Math.floor(Math.random() * matches.length)];

  return {
    flavor: {
      label: activity.label,
      description: activity.description,
      icon: activity.icon
    }
  };
}

