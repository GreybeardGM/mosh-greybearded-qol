import { appendQolThemeContext } from "../utils/application-options.js";
import { getDefaultShoreLeaveConfig, getNormalizedShoreLeaveConfig, getShoreLeaveConfigWithDefaults, hasValidShoreLeaveTiers } from "../shore-leave/config.js";
import { MODULE_ID, SETTING_SHORE_LEAVE_CONFIG } from "../codex/constants.js";
import {
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
    return appendQolThemeContext({
      options: config,
      tiers: config.tiers
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

    const submitted = getShoreLeaveConfigWithDefaults({ ...expanded.shoreLeave, tiers: tiersArray });
    const usedDefaultTiersFallback = !hasValidShoreLeaveTiers(tiersArray);

    if (usedDefaultTiersFallback) {
      notifyLocalized("warn", "MoshQoL.ShoreLeave.Editor.DefaultTiersFallback");
    }

    await saveSettingAndClose(this, MODULE_ID, SETTING_SHORE_LEAVE_CONFIG, submitted);
  }
}
