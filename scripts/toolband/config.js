import { MODULE_ID, SETTING_TOOLBAND_CONFIG } from "../codex/constants.js";
import { TOOLBAND_SCOPES, getConfigurableToolbandButton, getConfigurableToolbandButtonsForScope, isToolbandButtonConfigurableForScope } from "../codex/toolband-buttons.js";

export function mapConfigurableToolbandScopes(mapButtons) {
  return Object.fromEntries(
    TOOLBAND_SCOPES.map((scope) => [
      scope,
      Object.fromEntries(getConfigurableToolbandButtonsForScope(scope).map((button) => mapButtons(button, scope)))
    ])
  );
}

export function getDefaultToolbandConfig() {
  return mapConfigurableToolbandScopes((button) => [button.settingKey, button.defaultEnabled !== false]);
}

export function normalizeToolbandConfig(config) {
  const defaults = getDefaultToolbandConfig();
  return mapConfigurableToolbandScopes((button, scope) => {
    const value = config?.[scope]?.[button.settingKey];
    return [button.settingKey, typeof value === "boolean" ? value : defaults[scope][button.settingKey]];
  });
}

function getToolbandScope(kind) {
  return TOOLBAND_SCOPES.includes(kind) ? kind : null;
}

export function getNormalizedToolbandConfig() {
  return normalizeToolbandConfig(game.settings.get(MODULE_ID, SETTING_TOOLBAND_CONFIG));
}

export function isToolbandButtonEnabledInConfig(kind, action, config) {
  const button = getConfigurableToolbandButton(action);
  if (!button) return true;

  const scope = getToolbandScope(kind);
  if (!isToolbandButtonConfigurableForScope(button, scope)) return false;

  return config?.[scope]?.[button.settingKey] !== false;
}
