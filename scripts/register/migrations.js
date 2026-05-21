import { migrateLegacyShipCritToolbandConfig } from "../migration/toolband.js";
import { migrateLegacyShoreLeaveConfig } from "../migration/shore-leave.js";

export function runReadyMigrations() {
  migrateLegacyShipCritToolbandConfig().catch((error) => {
    console.error("[MoSh QoL] Failed to migrate legacy ship crit setting", error);
  });

  migrateLegacyShoreLeaveConfig().catch((error) => {
    console.error("[MoSh QoL] Failed to migrate legacy shore leave settings", error);
  });
}
