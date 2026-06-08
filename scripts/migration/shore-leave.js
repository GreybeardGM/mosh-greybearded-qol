import {
  getDefaultShoreLeaveConfig,
  getShoreLeaveConfigWithDefaults,
  hasValidShoreLeaveTiers,
  normalizeShoreLeaveTiers
} from "../settings/shore-leave-config.js";
import { MODULE_ID, SETTING_SHORE_LEAVE_CONFIG } from "../codex/constants.js";
import { SHORE_LEAVE_TIERS } from "../shore-leave/default-tiers.js";

export const SHORE_LEAVE_CONFIG_MIGRATION_SETTING = "migrations.shoreLeaveConfig";
export const LEGACY_SHORE_LEAVE_TIERS_SETTING = "shoreLeaveTiers";

const LEGACY_SHORE_LEAVE_SETTINGS = {
  convertStress: {
    noSanitySave: "convertStress.noSanitySave",
    noStressRelieve: "convertStress.noStressRelieve",
    minStressConversion: "convertStress.minStressConversion",
    formula: "convertStress.formula"
  },
  simpleShoreLeave: {
    randomFlavor: "simpleShoreLeave.randomFlavor"
  }
};

function hasStoredWorldSetting(moduleId, settingKey) {
  const worldStorage = game.settings.storage?.get?.("world");
  if (!worldStorage) return false;

  const storageKey = `${moduleId}.${settingKey}`;
  if (typeof worldStorage.has === "function" && worldStorage.has(storageKey)) return true;
  if (typeof worldStorage.get === "function" && worldStorage.get(storageKey)) return true;
  if (typeof worldStorage.find === "function" && worldStorage.find((setting) => setting?.key === storageKey)) return true;

  const values = Array.isArray(worldStorage.contents)
    ? worldStorage.contents
    : typeof worldStorage.values === "function"
      ? Array.from(worldStorage.values())
      : [];

  return values.some((setting) => setting?.key === storageKey);
}

export async function migrateLegacyShoreLeaveConfig() {
  if (!game.user?.isGM) return;
  if (game.settings.get(MODULE_ID, SHORE_LEAVE_CONFIG_MIGRATION_SETTING)) return;

  const config = getShoreLeaveConfigWithDefaults(game.settings.get(MODULE_ID, SETTING_SHORE_LEAVE_CONFIG));
  const defaults = getDefaultShoreLeaveConfig();

  for (const [key, setting] of Object.entries(LEGACY_SHORE_LEAVE_SETTINGS.convertStress)) {
    const value = game.settings.get(MODULE_ID, setting);
    if (typeof defaults.convertStress[key] === "boolean") {
      config.convertStress[key] = value === true;
    } else if (typeof value === "string" && value.trim()) {
      config.convertStress[key] = value.trim();
    }
  }

  for (const [key, setting] of Object.entries(LEGACY_SHORE_LEAVE_SETTINGS.simpleShoreLeave)) {
    const value = game.settings.get(MODULE_ID, setting);
    if (typeof defaults.simpleShoreLeave[key] === "boolean") {
      config.simpleShoreLeave[key] = value === true;
    }
  }

  const hasStoredLegacyTiers = hasStoredWorldSetting(MODULE_ID, LEGACY_SHORE_LEAVE_TIERS_SETTING);
  const legacyTiers = hasStoredLegacyTiers ? game.settings.get(MODULE_ID, LEGACY_SHORE_LEAVE_TIERS_SETTING) : null;
  const tierOrder = ["X", "C", "B", "A", "S"];
  const getTierSortIndex = (tier) => {
    const index = tierOrder.indexOf(tier);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  // Legacy-only migration tolerance: object-shaped tiers were stored by older versions.
  // Runtime code only accepts the new array format for `shoreLeaveConfig.tiers`.
  let normalizedLegacyTiers = null;
  if (Array.isArray(legacyTiers)) {
    normalizedLegacyTiers = foundry.utils.deepClone(legacyTiers);
  } else if (legacyTiers && typeof legacyTiers === "object") {
    normalizedLegacyTiers = foundry.utils.deepClone(Object.values(legacyTiers));
  }

  const hasValidLegacyTiers = hasStoredLegacyTiers && hasValidShoreLeaveTiers(normalizedLegacyTiers);
  if (hasValidLegacyTiers) {
    config.tiers = normalizeShoreLeaveTiers(normalizedLegacyTiers, { fallbackToDefaults: false }).sort((a, b) => {
      const tierA = typeof a?.tier === "string" ? a.tier : "";
      const tierB = typeof b?.tier === "string" ? b.tier : "";
      return getTierSortIndex(tierA) - getTierSortIndex(tierB);
    });
  } else if (hasStoredLegacyTiers || !hasValidShoreLeaveTiers(config.tiers)) {
    config.tiers = foundry.utils.deepClone(SHORE_LEAVE_TIERS);
  }

  config.tiers = normalizeShoreLeaveTiers(config.tiers);

  await game.settings.set(MODULE_ID, SETTING_SHORE_LEAVE_CONFIG, config);
  await game.settings.set(MODULE_ID, SHORE_LEAVE_CONFIG_MIGRATION_SETTING, true);
}
