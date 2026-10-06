import { MODULE_ID, SETTING_SHORE_LEAVE_CONFIG } from "../codex/constants.js";
import { SHORE_LEAVE_TIERS } from "./default-tiers.js";

export function getDefaultShoreLeaveConfig() {
  return {
    convertStress: {
      noSanitySave: false,
      noStressRelieve: false,
      minStressConversion: false,
      formula: "1d5"
    },
    simpleShoreLeave: {
      randomFlavor: true
    },
    tiers: foundry.utils.deepClone(SHORE_LEAVE_TIERS)
  };
}

function hasRequiredTierFields(tier) {
  return (
    tier &&
    typeof tier === "object" &&
    typeof tier.tier === "string" &&
    tier.tier.trim() &&
    typeof tier.label === "string" &&
    tier.label.trim() &&
    tier.baseStressConversion &&
    typeof tier.baseStressConversion === "object" &&
    tier.basePrice &&
    typeof tier.basePrice === "object"
  );
}

function getValidShoreLeaveTiers(tiers) {
  if (!Array.isArray(tiers) || !tiers.length) return [];
  return tiers.filter(hasRequiredTierFields);
}

export function hasValidShoreLeaveTiers(tiers) {
  return getValidShoreLeaveTiers(tiers).length > 0;
}

export function normalizeShoreLeaveTiers(tiers, { fallbackToDefaults = true } = {}) {
  const validTiers = getValidShoreLeaveTiers(tiers);
  if (!validTiers.length) {
    return fallbackToDefaults ? foundry.utils.deepClone(SHORE_LEAVE_TIERS) : [];
  }

  return foundry.utils.deepClone(validTiers);
}

export function getShoreLeaveConfigWithDefaults(config) {
  const normalized = normalizeShoreLeaveConfig(config);
  normalized.tiers = normalizeShoreLeaveTiers(config?.tiers);
  return normalized;
}

function normalizeShoreLeaveConfig(config) {
  const normalized = foundry.utils.deepClone(getDefaultShoreLeaveConfig());

  if (config?.convertStress && typeof config.convertStress === "object") {
    for (const key of ["noSanitySave", "noStressRelieve", "minStressConversion"]) {
      if (typeof config.convertStress[key] === "boolean") normalized.convertStress[key] = config.convertStress[key];
    }
    if (typeof config.convertStress.formula === "string" && config.convertStress.formula.trim()) {
      normalized.convertStress.formula = config.convertStress.formula.trim();
    }
  }

  if (config?.simpleShoreLeave && typeof config.simpleShoreLeave === "object") {
    if (typeof config.simpleShoreLeave.randomFlavor === "boolean") {
      normalized.simpleShoreLeave.randomFlavor = config.simpleShoreLeave.randomFlavor;
    }
  }

  return normalized;
}

export function getNormalizedShoreLeaveConfig() {
  return getShoreLeaveConfigWithDefaults(game.settings.get(MODULE_ID, SETTING_SHORE_LEAVE_CONFIG));
}
