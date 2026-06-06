import { SHORE_LEAVE_TIERS } from "../codex/default-shore-leave-tiers.js";
import { getThemeColor } from "../utils/get-theme-color.js";
import { MODULE_ID, SETTING_SHORE_LEAVE_CONFIG } from "../codex/constants.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export { MODULE_ID };
export const SHORE_LEAVE_CONFIG_SETTING = SETTING_SHORE_LEAVE_CONFIG;

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

export function getValidShoreLeaveTiers(tiers) {
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

function usesDefaultShoreLeaveTiersFallback(tiers) {
  return !hasValidShoreLeaveTiers(tiers);
}

export function getNormalizedShoreLeaveTiers(config) {
  return normalizeShoreLeaveTiers(config?.tiers);
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

export function normalizeShoreLeaveConfig(config) {
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
  return getShoreLeaveConfigWithDefaults(game.settings.get(MODULE_ID, SHORE_LEAVE_CONFIG_SETTING));
}

export class ShoreLeaveConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "shore-leave-config",
    tag: "form",
    window: {
      title: "MoshQoL.Settings.ShoreLeaveEditor.Name",
      contentClasses: ["greybeardqol", "qol-ui", "qolsettings-window"],
      resizable: true
    },
    position: {
      width: 550,
      height: "auto"
    },
    form: {
      handler: this._onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      resetDefaults: this._onResetDefaults
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/settings/shore-leave-config.html`
    }
  };

  async _prepareContext() {
    const config = getNormalizedShoreLeaveConfig();
    return {
      options: config,
      tiers: foundry.utils.deepClone(config.tiers),
      themeColor: getThemeColor()
    };
  }

  static async _onResetDefaults(event) {
    event.preventDefault();

    await game.settings.set(
      MODULE_ID,
      SHORE_LEAVE_CONFIG_SETTING,
      getDefaultShoreLeaveConfigWithTiers(SHORE_LEAVE_TIERS)
    );

    this.render();
    ui.notifications.info(game.i18n.localize("MoshQoL.ShoreLeave.Editor.ResetSuccess"));
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
    const usedDefaultTiersFallback = usesDefaultShoreLeaveTiersFallback(tiersArray);
    submitted.tiers = getNormalizedShoreLeaveTiers({ tiers: tiersArray });

    if (usedDefaultTiersFallback) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.ShoreLeave.Editor.DefaultTiersFallback"));
    }

    await game.settings.set(MODULE_ID, SHORE_LEAVE_CONFIG_SETTING, submitted);

    ui.notifications.info(game.i18n.localize("MoshQoL.ShoreLeave.Editor.UpdateSuccess"));
    this.close();
  }
}
