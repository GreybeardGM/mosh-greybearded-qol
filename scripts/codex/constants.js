// Module-wide IDs, settings, flags, and default CSS class names belong here.
// Keep feature-local constants in their feature module only when no other file needs them.
export const MODULE_ID = "mosh-greybearded-qol";
export const MODULE_PATH = `modules/${MODULE_ID}`;
export const DEFAULT_THEME_COLOR = "#f50";

export const QOL_NAMESPACE_CLASS = "greybeardqol";
export const QOL_UI_CLASS = "qol-ui";
export const QOL_SHEET_CLASS = "qol-sheet";
export const CHAT_ACTION_CLASS = "chat-action";

export const QOL_UI_CLASSES = Object.freeze([QOL_NAMESPACE_CLASS, QOL_UI_CLASS]);
export const QOL_SHEET_CLASSES = Object.freeze([QOL_NAMESPACE_CLASS, QOL_SHEET_CLASS]);

export function qolWindowClasses(...extraClasses) {
  return [...QOL_UI_CLASSES, ...extraClasses.filter(Boolean)];
}

export function qolSheetClasses(...extraClasses) {
  return ["mosh", ...QOL_SHEET_CLASSES, "sheet", ...extraClasses.filter(Boolean)];
}

export function qolClassName(...extraClasses) {
  return qolWindowClasses(...extraClasses).join(" ");
}

export const CHAT_ACTION_SELECTOR = `.${QOL_NAMESPACE_CLASS} .${CHAT_ACTION_CLASS}`;

export function modulePath(relativePath = "") {
  const normalizedPath = String(relativePath ?? "").replace(/^\/+/, "");
  return normalizedPath ? `${MODULE_PATH}/${normalizedPath}` : MODULE_PATH;
}

function normalizeRelativePath(relativePath = "") {
  return String(relativePath ?? "").replace(/^\/+/, "");
}

export function templatePath(relativePath) {
  return modulePath(`templates/${normalizeRelativePath(relativePath)}`);
}

export function assetPath(relativePath) {
  return modulePath(`assets/${normalizeRelativePath(relativePath)}`);
}

export const STATUS_ARMOR_BROKEN = "qol-broken-armor";

export const FLAG_CHARACTER_CREATION = "greybeardCharacterCreation";
export const FLAG_CREW_ROSTER = "crewRoster";

export const SETTING_ENABLE_CHARACTER_CREATOR = "enableCharacterCreator";
export const SETTING_THEME_COLOR = "themeColor";
export const SETTING_THEME_COLOR_OVERRIDE = "themeColorOverride";
export const SETTING_APPLY_DAMAGE_CONFIG = "applyDamageConfig";
export const SETTING_APPLY_DAMAGE_TARGET_LOGIC = "applyDamageTargetLogic";
export const SETTING_SHORE_LEAVE_CONFIG = "shoreLeaveConfig";
export const SETTING_SIMPLE_SHORE_LEAVE_DISABLE_FLAVOR = "simpleShoreLeave.disableFlavor";
export const SETTING_TOOLBAND_CONFIG = "toolbandConfig";
