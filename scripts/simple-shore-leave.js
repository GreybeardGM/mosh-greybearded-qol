import { getThemeColor } from "./utils/get-theme-color.js";
import { toRollFormula } from "./utils/to-roll-formula.js";
import { toRollString } from "./utils/to-roll-string.js";
import { SimpleShoreLeaveApp } from "./ui/simple-shore-leave-app.js";
import { flavorizeShoreLeave } from "./utils/flavorize-shore-leave.js";

export async function simpleShoreLeave(actor, randomFlavor) {
  if (!actor) return ui.notifications.warn("No actor provided.");
  const flavorDisabled = game.settings.get("mosh-greybearded-qol", "simpleShoreLeave.disableFlavor");
  randomFlavor = flavorDisabled ? false : (randomFlavor ?? game.settings.get("mosh-greybearded-qol", "simpleShoreLeave.randomFlavor"));

  // Load config from settings
  const config = game.settings.get("mosh-greybearded-qol", "shoreLeaveTiers");
  const configArray = Object.values(config);
  const tiers = configArray.map(tier => {
    let base = {
      tier: tier.tier,
      label: tier.label,
      icon: tier.icon ?? null,
      stressFormula: toRollFormula(tier.baseStressConversion),
      stressString: toRollString(tier.baseStressConversion),
      priceFormula: toRollFormula(tier.basePrice),
      priceString: toRollString(tier.basePrice),
      raw: tier
    };
    // Add random flavor overlay if enabled
    if (randomFlavor) flavorizeShoreLeave(base);
    return base;
  });

  const themeColor = getThemeColor();
  return SimpleShoreLeaveApp.wait({ actor, tiers, themeColor });
}
