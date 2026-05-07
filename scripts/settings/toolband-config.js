import {
  TOOLBAND_SCOPES,
  getConfigurableToolbandButton,
  getConfigurableToolbandButtonsForScope,
  getToolbandButtonDefaultEnabled,
  getToolbandButtonLabel,
  isToolbandButtonConfigurableForScope
} from "./toolband-buttons.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const MODULE_ID = "mosh-greybearded-qol";
export const TOOLBAND_CONFIG_SETTING = "toolbandConfig";

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

export function getToolbandScope(kind) {
  return kind === "ship" ? "ship" : "tech";
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

export function isToolbandButtonEnabled(kind, action) {
  return isToolbandButtonEnabledInConfig(kind, action, getNormalizedToolbandConfig());
}

export class ToolbandConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "toolband-config",
    tag: "form",
    window: {
      title: "MoshQoL.Settings.ToolbandConfig.Name",
      contentClasses: ["greybeardqol", "toolband-config"],
      resizable: true
    },
    position: {
      width: 640,
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
      template: "modules/mosh-greybearded-qol/templates/settings/toolband-config.html"
    }
  };

  async _prepareContext() {
    const config = getNormalizedToolbandConfig();
    const scopes = TOOLBAND_SCOPES.map((scope) => ({
      id: scope,
      label: game.i18n.localize(`MoshQoL.Toolbar.Scopes.${scope === "tech" ? "Tech" : "Ship"}`),
      buttons: getConfigurableToolbandButtonsForScope(scope).map((button) => ({
        ...button,
        checked: config[scope][button.settingKey],
        labelText: getToolbandButtonLabel(button)
      }))
    }));

    return {
      description: game.i18n.localize("MoshQoL.Toolbar.Config.Description"),
      scopes
    };
  }

  static async _onResetDefaults(event) {
    event.preventDefault();
    await game.settings.set(MODULE_ID, TOOLBAND_CONFIG_SETTING, getDefaultToolbandConfig());
    this.render();
    ui.notifications.info(game.i18n.localize("MoshQoL.Toolbar.Config.ResetSuccess"));
  }

  static async _onSubmit(event, form, formData) {
    const expanded = foundry.utils.expandObject(formData.object ?? {});
    const submitted = expanded.toolband ?? {};
    const current = getDefaultToolbandConfig();

    for (const scope of TOOLBAND_SCOPES) {
      for (const button of getConfigurableToolbandButtonsForScope(scope)) {
        current[scope][button.settingKey] = Object.prototype.hasOwnProperty.call(submitted?.[scope] ?? {}, button.settingKey);
      }
    }

    await game.settings.set(MODULE_ID, TOOLBAND_CONFIG_SETTING, current);
    ui.notifications.info(game.i18n.localize("MoshQoL.Toolbar.Config.UpdateSuccess"));
    this.close();
  }
}
