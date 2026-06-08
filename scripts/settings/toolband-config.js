import { normalizeBoolean } from "../utils/normalization.js";
import {
  TOOLBAND_SCOPES,
  getConfigurableToolbandButton,
  getConfigurableToolbandButtonsForScope,
  getToolbandButtonDefaultEnabled,
  getToolbandButtonLabel,
  getToolbandScopeLabel,
  getToolbandScopes,
  isToolbandButtonConfigurableForScope
} from "../codex/toolband-buttons.js";
import { MODULE_ID, SETTING_TOOLBAND_CONFIG } from "../codex/constants.js";
import {
  appendThemeColor,
  createSettingsAppDefaultOptions,
  createSettingsAppParts,
  resetSettingToDefaults,
  setSettingAndNotify
} from "./settings-app-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export { MODULE_ID };
export const TOOLBAND_CONFIG_SETTING = SETTING_TOOLBAND_CONFIG;

export function getDefaultToolbandConfig() {
  return Object.fromEntries(
    TOOLBAND_SCOPES.map((scope) => [
      scope,
      Object.fromEntries(
        getConfigurableToolbandButtonsForScope(scope)
          .map((button) => [button.settingKey, getToolbandButtonDefaultEnabled(button, scope)])
      )
    ])
  );
}

export function normalizeToolbandConfig(config) {
  const defaults = getDefaultToolbandConfig();
  const normalized = foundry.utils.deepClone(defaults);

  for (const scope of TOOLBAND_SCOPES) {
    const scopeConfig = config?.[scope];
    if (!scopeConfig || typeof scopeConfig !== "object") continue;

    for (const button of getConfigurableToolbandButtonsForScope(scope)) {
      if (typeof scopeConfig[button.settingKey] === "boolean") {
        normalized[scope][button.settingKey] = scopeConfig[button.settingKey];
      }
    }
  }

  return normalized;
}

function getToolbandScope(kind) {
  return TOOLBAND_SCOPES.includes(kind) ? kind : null;
}

export function getNormalizedToolbandConfig() {
  return normalizeToolbandConfig(game.settings.get(MODULE_ID, TOOLBAND_CONFIG_SETTING));
}

export function isToolbandButtonEnabledInConfig(kind, action, config) {
  const button = getConfigurableToolbandButton(action);
  if (!button) return true;

  const scope = getToolbandScope(kind);
  if (!isToolbandButtonConfigurableForScope(button, scope)) return false;

  return config?.[scope]?.[button.settingKey] !== false;
}

export class ToolbandConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createSettingsAppDefaultOptions({
    id: "toolband-config",
    title: "MoshQoL.Settings.ToolbandConfig.Name",
    submitHandler: this._onSubmit,
    resetDefaultsHandler: this._onResetDefaults
  });

  static PARTS = createSettingsAppParts(MODULE_ID, "templates/settings/toolband-config.html");

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
      settingKey: TOOLBAND_CONFIG_SETTING,
      defaults: getDefaultToolbandConfig,
      notificationKey: "MoshQoL.Toolbar.Config.ResetSuccess"
    });
  }

  static async _onSubmit(event, form, formData) {
    const expanded = foundry.utils.expandObject(formData.object ?? {});
    const submitted = expanded.toolband ?? {};
    const current = getDefaultToolbandConfig();

    for (const scope of TOOLBAND_SCOPES) {
      const scopeSubmission = submitted?.[scope] ?? {};

      for (const button of getConfigurableToolbandButtonsForScope(scope)) {
        const value = scopeSubmission[button.settingKey];
        current[scope][button.settingKey] = normalizeBoolean(value);
      }
    }

    await setSettingAndNotify(MODULE_ID, TOOLBAND_CONFIG_SETTING, current, "MoshQoL.Toolbar.Config.UpdateSuccess");
    this.close();
  }
}
