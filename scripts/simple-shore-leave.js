import { convertStress } from "./convert-stress.js";
import { toRollFormula, toRollString } from "./utils/to-roll-formula.js";
import { SHORE_LEAVE_TIERS } from "./config/default-shore-leave-tiers.js";
import { SHORE_LEAVE_ACTIVITIES } from "./config/default-shore-leave-activities.js";

export async function simpleShoreLeave(actor) {
  if (!actor) return ui.notifications.warn("No actor provided.");

  // Hardcoded short list of activities
  const OFFERED_IDS = ["betteru", "club-novacaine", "bunraku", "miras-mind-bath", "communal-garden"];
  const ALL_ACTIVITIES = SHORE_LEAVE_ACTIVITIES[0].activities;
  const TIERS = Object.fromEntries(SHORE_LEAVE_TIERS.map(t => [t.tier, t]));

  const activities = OFFERED_IDS.map(id => {
    const activity = ALL_ACTIVITIES.find(a => a.id === id);
    const tier = TIERS[activity.tier];
    return {
      id: activity.id,
      label: activity.label,
      description: activity.description,
      icon: activity.icon || null,
      tier: activity.tier,
      stressFormula: toRollFormula(tier.baseStressConversion),
      stressString: toRollString(tier.baseStressConversion),
      priceFormula: toRollFormula(tier.basePrice),
      priceString: toRollString(tier.basePrice)
    };
  });

  const content = await renderTemplate("modules/mosh-greybearded-qol/templates/simple-shore-leave.html", {
    tiers: activities
  });

  return new Promise(resolve => {
    new Dialog({
      title: "Select Shore Leave Activity",
      content,
      buttons: {
        confirm: {
          label: "Convert Stress",
          callback: async (html) => {
            const selected = html.find("input[name='shore-tier']:checked").val();
            const entry = activities.find(t => t.id === selected);
            if (!entry) return ui.notifications.error("Invalid selection.");

            const result = await convertStress(actor, entry.stressFormula);
            resolve(result);
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      render: html => {
        html.find(".roll-price").on("click", async ev => {
          const id = ev.currentTarget.dataset.id;
          const entry = activities.find(a => a.id === id);
          if (!entry) return;
          const roll = new Roll(entry.priceFormula);
          await roll.evaluate({ async: false });
          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `Price for ${entry.label}`
          });
        });

        html.find("input[name='shore-tier']").on("change", function () {
          html.find(".card").removeClass("highlighted");
          const selected = html.find("input[name='shore-tier']:checked").closest(".card");
          selected.addClass("highlighted");
        });

        html.closest('.app').css({
          width: '900px',
          maxWidth: '95vw',
          margin: '0 auto'
        });
      },
      default: "confirm"
    }).render(true);
  });
}
