import { normalizeToolbandConfig } from "../settings/toolband-config.js";
import { MODULE_ID, SETTING_TOOLBAND_CONFIG } from "../codex/constants.js";

export const LEGACY_SHIP_CRITS_SETTING = "enableShipCrits";
export const SHIP_CRITS_MIGRATION_SETTING = "migrations.toolbandShipCrits";

export async function migrateLegacyShipCritToolbandConfig() {
  if (!game.user?.isGM) return;
  if (game.settings.get(MODULE_ID, SHIP_CRITS_MIGRATION_SETTING)) return;

  const config = normalizeToolbandConfig(game.settings.get(MODULE_ID, SETTING_TOOLBAND_CONFIG));
  config.ship.shipCrit = game.settings.get(MODULE_ID, LEGACY_SHIP_CRITS_SETTING) === true;

  await game.settings.set(MODULE_ID, SETTING_TOOLBAND_CONFIG, config);
  await game.settings.set(MODULE_ID, SHIP_CRITS_MIGRATION_SETTING, true);
}
