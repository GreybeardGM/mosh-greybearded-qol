import { FEATURE_ACTIONS } from "./feature-actions.js";

export const TOOLBAND_SCOPE_META = [
  {
    id: "character",
    labelKey: "MoshQoL.Common.PlayerCharacters"
  },
  {
    id: "contractor",
    labelKey: "MoshQoL.Common.Contractor"
  },
  {
    id: "creature",
    labelKey: "MoshQoL.Toolbar.Scopes.creature"
  },
  {
    id: "ship",
    labelKey: "MoshQoL.Toolbar.Scopes.ship"
  },
  {
    id: "stash",
    labelKey: "MoshQoL.Toolbar.Scopes.stash"
  }
];

export const TOOLBAND_SCOPES = TOOLBAND_SCOPE_META.map((scope) => scope.id);

export const TOOLBAND_BUTTONS = [
  {
    ...FEATURE_ACTIONS["apply-damage"],
    configurable: true,
    scopes: ["character", "creature"]
  },
  {
    ...FEATURE_ACTIONS["armor-broken"],
    configurable: true,
    scopes: ["character", "contractor", "creature"]
  },
  {
    ...FEATURE_ACTIONS["shore-leave"],
    configurable: true,
    scopes: ["character"]
  },
  {
    ...FEATURE_ACTIONS.training,
    configurable: true,
    scopes: ["character"]
  },
  {
    ...FEATURE_ACTIONS["ship-crew-roster"],
    configurable: true,
    scopes: ["ship", "stash"]
  },
  {
    ...FEATURE_ACTIONS["ship-crit"],
    configurable: true,
    scopes: ["ship"],
    defaultEnabled: false
  },
  {
    action: "roll-character",
    icon: "fas fa-dice-d20",
    label: "Roll Character",
    labelKey: "MoshQoL.Toolbar.Buttons.RollCharacter"
  },
  {
    action: "mark-complete",
    icon: "fas fa-flag-checkered",
    label: "Completed",
    labelKey: "MoshQoL.Toolbar.Buttons.Completed"
  },
  {
    action: "mark-ready",
    icon: "fas fa-check-circle",
    label: "Ready",
    labelKey: "MoshQoL.Toolbar.Buttons.Ready"
  },
  {
    action: "promote-contractor",
    icon: "fa-solid fa-user-check",
    label: "Promote",
    labelKey: "MoshQoL.Toolbar.Buttons.Promote"
  },
  {
    action: "contractor-menu",
    icon: "fa-solid fa-bars",
    label: "Menu",
    labelKey: "MoshQoL.Toolbar.Buttons.Menu"
  }
];

const CONFIGURABLE_TOOLBAND_BUTTONS = TOOLBAND_BUTTONS.filter((button) => button.configurable);

export function getToolbandScopes() {
  return TOOLBAND_SCOPE_META.map((scope) => ({ ...scope }));
}

export function getToolbandScopeMeta(scopeId) {
  return TOOLBAND_SCOPE_META.find((scope) => scope.id === scopeId) ?? null;
}

export function getToolbandScopeLabel(scopeId) {
  const meta = getToolbandScopeMeta(scopeId);
  if (!meta) return scopeId ?? "";
  if (meta.labelKey && typeof game !== "undefined" && game?.i18n) return game.i18n.localize(meta.labelKey);
  return meta.label ?? meta.id;
}

export function getToolbandButtonMeta(action) {
  return TOOLBAND_BUTTONS.find((button) => button.action === action) ?? null;
}

export function getConfigurableToolbandButton(action) {
  return CONFIGURABLE_TOOLBAND_BUTTONS.find((button) => button.action === action) ?? null;
}

function getToolbandButtonScopes(button) {
  if (!button?.configurable || !Array.isArray(button.scopes)) return [];
  return button.scopes;
}

export function isToolbandButtonConfigurableForScope(button, scope) {
  return getToolbandButtonScopes(button).includes(scope);
}

export function getConfigurableToolbandButtonsForScope(scope) {
  return CONFIGURABLE_TOOLBAND_BUTTONS.filter((button) => isToolbandButtonConfigurableForScope(button, scope));
}

export function getToolbandButtonDefaultEnabled(button, scope) {
  if (!isToolbandButtonConfigurableForScope(button, scope)) return undefined;
  return button.defaultEnabled !== false;
}

export function getToolbandButtonLabel(button) {
  if (!button) return "";
  if (button.labelKey && typeof game !== "undefined" && game?.i18n) return game.i18n.localize(button.labelKey);
  return button.label ?? button.action;
}

export function makeToolbandButton(action, overrides = {}) {
  const meta = getToolbandButtonMeta(action);
  if (!meta) return { id: action, action, ...overrides };

  return {
    id: meta.action,
    action: meta.action,
    icon: meta.icon,
    label: getToolbandButtonLabel(meta),
    ...overrides
  };
}
