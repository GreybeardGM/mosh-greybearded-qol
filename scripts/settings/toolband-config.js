import { getDefaultToolbandConfig, getNormalizedToolbandConfig, mapConfigurableToolbandScopes } from "../toolband/config.js";
import { normalizeBoolean } from "../utils/normalization.js";
import { getConfigurableToolbandButtonsForScope, getToolbandButtonLabel, getToolbandScopeLabel, getToolbandScopes } from "../codex/toolband-buttons.js";
import { MODULE_ID, SETTING_TOOLBAND_CONFIG } from "../codex/constants.js";
import {
  appendThemeColor,
  createSettingsAppDefaultOptions,
  createSettingsAppParts,
  resetSettingToDefaults,
  saveSettingAndClose
} from "./settings-app-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ToolbandConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createSettingsAppDefaultOptions({
    id: "toolband-config",
    title: "MoshQoL.Settings.ToolbandConfig.Name",
    submitHandler: this._onSubmit,
    resetDefaultsHandler: this._onResetDefaults
  });

  static PARTS = createSettingsAppParts("settings/toolband-config.html");

  async _prepareContext() {
    const config = getNormalizedToolbandConfig();
    const scopes = getToolbandScopes().map(({ id }) => ({
      id,
      label: getToolbandScopeLabel(id),
      buttons: getConfigurableToolbandButtonsForScope(id).map((button) => ({
        ...button,
        checked: config[id][button.settingKey],
        labelText: getToolbandButtonLabel(button)
      }))
    }));

    return appendThemeColor({ scopes });
  }

  static async _onResetDefaults(event) {
    await resetSettingToDefaults(this, event, {
      moduleId: MODULE_ID,
      settingKey: SETTING_TOOLBAND_CONFIG,
      defaults: getDefaultToolbandConfig
    });
  }

  static async _onSubmit(event, form, formData) {
    const expanded = foundry.utils.expandObject(formData.object ?? {});
    const submitted = expanded.toolband ?? {};
    const current = mapConfigurableToolbandScopes((button, scope) => [
      button.settingKey,
      normalizeBoolean(submitted?.[scope]?.[button.settingKey])
    ]);

    await saveSettingAndClose(this, MODULE_ID, SETTING_TOOLBAND_CONFIG, current);
  }
}
