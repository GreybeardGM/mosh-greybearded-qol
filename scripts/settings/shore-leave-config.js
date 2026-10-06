import { getDefaultShoreLeaveConfig, getNormalizedShoreLeaveConfig, getShoreLeaveConfigWithDefaults, hasValidShoreLeaveTiers, normalizeShoreLeaveTiers } from "../shore-leave/config.js";
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
      defaults: getDefaultShoreLeaveConfig
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

    await saveSettingAndClose(this, MODULE_ID, SETTING_SHORE_LEAVE_CONFIG, submitted);
  }
}
