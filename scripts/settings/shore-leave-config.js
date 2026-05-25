import { getThemeColor } from "../utils/get-theme-color.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const MODULE_ID = "mosh-greybearded-qol";
export const SHORE_LEAVE_CONFIG_SETTING = "shoreLeaveConfig";

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
    tiers: []
  };
}

function normalizeShoreLeaveTiers(tiers) {
  if (!Array.isArray(tiers)) return [];
  return foundry.utils.deepClone(tiers);
}

export function getNormalizedShoreLeaveTiers(config) {
  return normalizeShoreLeaveTiers(config?.tiers);
}

export function getShoreLeaveTiersFromSettings() {
  return getNormalizedShoreLeaveTiers(game.settings.get(MODULE_ID, SHORE_LEAVE_CONFIG_SETTING));
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
      contentClasses: ["greybeardqol", "qolsettings-window"],
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
      template: "modules/mosh-greybearded-qol/templates/settings/shore-leave-config.html"
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
    const module = await import("../codex/default-shore-leave-tiers.js");

    await game.settings.set(
      MODULE_ID,
      SHORE_LEAVE_CONFIG_SETTING,
      getDefaultShoreLeaveConfigWithTiers(module.SHORE_LEAVE_TIERS)
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
    submitted.tiers = normalizeShoreLeaveTiers(tiersArray);

    await game.settings.set(MODULE_ID, SHORE_LEAVE_CONFIG_SETTING, submitted);

    ui.notifications.info(game.i18n.localize("MoshQoL.ShoreLeave.Editor.UpdateSuccess"));
    this.close();
  }
}
