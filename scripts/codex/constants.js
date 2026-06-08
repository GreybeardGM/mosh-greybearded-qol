export const MODULE_ID = "mosh-greybearded-qol";
export const MODULE_PATH = `modules/${MODULE_ID}`;

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
export const SETTING_TOOLBAND_CONFIG = "toolbandConfig";
