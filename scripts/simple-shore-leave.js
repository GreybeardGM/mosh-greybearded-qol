import { SHORE_LEAVE_TIERS } from "./config/default-shore-leave-tiers.js";
import { toRollFormula } from "./utils/to-roll-formula.js";
import { convertStress } from "./convert-stress.js";

export async function simpleShoreLeave(actor) {
  if (!actor) return ui.notifications.warn("No actor provided.");

  const content = await renderTemplate("modules/mosh-greybearded-qol/templates/simple-shore-leave.html", {
    tiers: SHORE_LEAVE_TIERS
  });

  return new Promise(resolve => {
    new Dialog({
      title: "Select Shore Leave Tier",
      content,
      buttons: {
        confirm: {
          label: "Convert Stress",
          callback: async (html) => {
            const selected = html.find("input[name='shore-tier']:checked").val();
            const tier = SHORE_LEAVE_TIERS.find(t => t.tier === selected);
            if (!tier) return ui.notifications.error("Invalid tier selected.");

            const formula = toRollFormula(tier.baseStressConversion);
            const result = await convertStress(actor, formula);
            resolve(result);
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      render: html => {
        html.find(".roll-price").on("click", ev => {
          const tier = ev.currentTarget.dataset.tier;
          const config = SHORE_LEAVE_TIERS.find(t => t.tier === tier)?.basePrice;
          if (!config) return;
          const priceFormula = toRollFormula(config);
          const roll = new Roll(priceFormula);
          roll.roll({ async: true }).then(r => r.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `Price for ${tier}-Class Shore Leave` }));
        });
      },
      default: "confirm"
    }).render(true);
  });
}
