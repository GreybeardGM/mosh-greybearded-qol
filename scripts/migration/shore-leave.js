import {
  MODULE_ID,
  SHORE_LEAVE_CONFIG_SETTING,
  getDefaultShoreLeaveConfig,
  normalizeShoreLeaveConfig
} from "../settings/shore-leave-config.js";

export const SHORE_LEAVE_CONFIG_MIGRATION_SETTING = "migrations.shoreLeaveConfig";

const LEGACY_SHORE_LEAVE_SETTINGS = {
  convertStress: {
    noSanitySave: "convertStress.noSanitySave",
    noStressRelieve: "convertStress.noStressRelieve",
    minStressConversion: "convertStress.minStressConversion",
    formula: "convertStress.formula"
  },
  simpleShoreLeave: {
    randomFlavor: "simpleShoreLeave.randomFlavor"
  }
};

export async function migrateLegacyShoreLeaveConfig() {
  if (!game.user?.isGM) return;
  if (game.settings.get(MODULE_ID, SHORE_LEAVE_CONFIG_MIGRATION_SETTING)) return;

  const config = normalizeShoreLeaveConfig(game.settings.get(MODULE_ID, SHORE_LEAVE_CONFIG_SETTING));
  const defaults = getDefaultShoreLeaveConfig();

  for (const [key, setting] of Object.entries(LEGACY_SHORE_LEAVE_SETTINGS.convertStress)) {
    const value = game.settings.get(MODULE_ID, setting);
    if (typeof defaults.convertStress[key] === "boolean") {
      config.convertStress[key] = value === true;
    } else if (typeof value === "string" && value.trim()) {
      config.convertStress[key] = value.trim();
    }
  }

  for (const [key, setting] of Object.entries(LEGACY_SHORE_LEAVE_SETTINGS.simpleShoreLeave)) {
    const value = game.settings.get(MODULE_ID, setting);
    if (typeof defaults.simpleShoreLeave[key] === "boolean") {
      config.simpleShoreLeave[key] = value === true;
    }
  }

  await game.settings.set(MODULE_ID, SHORE_LEAVE_CONFIG_SETTING, config);
  await game.settings.set(MODULE_ID, SHORE_LEAVE_CONFIG_MIGRATION_SETTING, true);
}
