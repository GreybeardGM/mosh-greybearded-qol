export const TOOLBAND_SCOPES = ["character", "contractor", "creature", "ship", "stash"];

export const TOOLBAND_BUTTONS = [
  {
    action: "apply-damage",
    settingKey: "applyDamage",
    configurable: true,
    scopes: ["character", "creature"],
    icon: "fas fa-heart-broken",
    label: "Apply Damage",
    labelKey: "MoshQoL.Toolbar.Buttons.ApplyDamage"
  },
  {
    action: "armor-broken",
    settingKey: "armorBroken",
    configurable: true,
    scopes: ["character", "contractor", "creature"],
    icon: "fa-solid fa-shield-halved",
    label: "Armor Broken",
    labelKey: "MoshQoL.Toolbar.Buttons.ArmorBroken"
  },
  {
    action: "shore-leave",
    settingKey: "shoreLeave",
    configurable: true,
    scopes: ["character"],
    icon: "fas fa-umbrella-beach",
    label: "Shore Leave",
    labelKey: "MoshQoL.Common.ShoreLeave"
  },
  {
    action: "training",
    settingKey: "training",
    configurable: true,
    scopes: ["character"],
    icon: "fa-solid fa-dumbbell",
    label: "Training",
    labelKey: "MoshQoL.Toolbar.Buttons.Training"
  },
  {
    action: "ship-crew-roster",
    settingKey: "crewRoster",
    configurable: true,
    scopes: ["ship", "stash"],
    icon: "fa-solid fa-users",
    label: "Crew Roster",
    labelKey: "MoshQoL.Common.CrewRoster"
  },
  {
    action: "ship-crit",
    settingKey: "shipCrit",
    configurable: true,
    scopes: ["ship"],
    defaultEnabled: false,
    icon: "fas fa-explosion",
    label: "Critical Hit",
    labelKey: "MoshQoL.Toolbar.Buttons.ShipCrit"
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

export const CONFIGURABLE_TOOLBAND_BUTTONS = TOOLBAND_BUTTONS.filter((button) => button.configurable);

export function getToolbandButtonMeta(action) {
  return TOOLBAND_BUTTONS.find((button) => button.action === action) ?? null;
}

export function getConfigurableToolbandButton(action) {
  return CONFIGURABLE_TOOLBAND_BUTTONS.find((button) => button.action === action) ?? null;
}

export function getToolbandButtonScopes(button) {
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
