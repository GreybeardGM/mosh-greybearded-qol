import { SHORE_LEAVE_TIERS } from "../shore-leave/default-tiers.js";
import { MODULE_ID, SETTING_SHORE_LEAVE_CONFIG } from "../codex/constants.js";
import {
  appendThemeColor,
  createSettingsAppDefaultOptions,
  createSettingsAppParts,
  notifyLocalized,
  resetSettingToDefaults,
  saveSettingAndClose
} from "./settings-app-helpers.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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

export function getDefaultShoreLeaveConfigWithTiers(defaultTiers) {
  const defaults = getDefaultShoreLeaveConfig();
  defaults.tiers = normalizeShoreLeaveTiers(defaultTiers);
  return defaults;
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

export class ShoreLeaveConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createSettingsAppDefaultOptions({
    id: "shore-leave-config",
    title: "MoshQoL.Settings.ShoreLeaveEditor.Name",
    submitHandler: this._onSubmit,
    resetDefaultsHandler: this._onResetDefaults
  });

  static PARTS = createSettingsAppParts("settings/shore-leave-config.html");

  async _prepareContext() {
    const config = getNormalizedShoreLeaveConfig();
    return appendThemeColor({
      options: config,
      tiers: foundry.utils.deepClone(config.tiers)
    });
  }

  static async _onResetDefaults(event) {
    await resetSettingToDefaults(this, event, {
      moduleId: MODULE_ID,
      settingKey: SETTING_SHORE_LEAVE_CONFIG,
      defaults: () => getDefaultShoreLeaveConfigWithTiers(SHORE_LEAVE_TIERS),
      notificationKey: "MoshQoL.ShoreLeave.Editor.ResetSuccess"
    });
  }

  static async _onSubmit(event, form, formData) {
    const expanded = foundry.utils.expandObject(formData.object ?? {});
    const expandedTiers = expanded?.tiers;
    const tiersArray = Array.isArray(expandedTiers)
      ? expandedTiers
      : Object.entries(expandedTiers ?? {})
          .filter(([key]) => /^\d+$/.test(key))
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, tier]) => tier);

    const submitted = getShoreLeaveConfigWithDefaults(expanded.shoreLeave ?? {});
    const usedDefaultTiersFallback = !hasValidShoreLeaveTiers(tiersArray);
    submitted.tiers = normalizeShoreLeaveTiers(tiersArray);

    if (usedDefaultTiersFallback) {
      notifyLocalized("warn", "MoshQoL.ShoreLeave.Editor.DefaultTiersFallback");
    }

    await saveSettingAndClose(this, MODULE_ID, SETTING_SHORE_LEAVE_CONFIG, submitted, "MoshQoL.ShoreLeave.Editor.UpdateSuccess");
  }
}
