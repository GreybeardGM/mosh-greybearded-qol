import { MODULE_ID, SETTING_ENABLE_CYBERWARE } from "../codex/constants.js";
import { normalizeBoolean } from "../utils/normalization.js";
import {
  appendThemeColor,
  createSettingsAppDefaultOptions,
  createSettingsAppParts,
  resetSettingToDefaults,
  saveSettingAndClose
} from "./settings-app-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CyberwareConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createSettingsAppDefaultOptions({
    id: "cyberware-config",
    title: "MoshQoL.Settings.CyberwareConfig.Name",
    submitHandler: this._onSubmit,
    resetDefaultsHandler: this._onResetDefaults
  });

  static PARTS = createSettingsAppParts("settings/cyberware-config.html");

  async _prepareContext() {
    return appendThemeColor({
      enabled: game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)
    });
  }

  static async _onResetDefaults(event) {
    await resetSettingToDefaults(this, event, {
      moduleId: MODULE_ID,
      settingKey: SETTING_ENABLE_CYBERWARE,
      defaults: () => false
    });
  }

  static async _onSubmit(event, form, formData) {
    const enabled = normalizeBoolean(formData.object?.enabled);
    await saveSettingAndClose(this, MODULE_ID, SETTING_ENABLE_CYBERWARE, enabled);
  }
}
