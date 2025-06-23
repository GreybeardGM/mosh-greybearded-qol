import { toRollFormula } from "./utils/to-roll-formula.js";
import { toRollString } from "./utils/to-roll-string.js";
import { convertStress } from "./convert-stress.js";
import { flavorizeShoreLeave } from "./utils/flavorize-shore-leave.js";

export async function simpleShoreLeave(actor, randomFlavor = false) {
  if (!actor) return ui.notifications.warn("No actor provided.");

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

  const content = await renderTemplate("modules/mosh-greybearded-qol/templates/simple-shore-leave.html", {
    tiers
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
            const entry = tiers.find(t => t.tier === selected);
            if (!entry) return ui.notifications.error("Invalid tier selected.");

            const result = await convertStress(actor, entry.stressFormula);
            resolve(result);
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      render: async html => {
        // Highlight selected tier card
        html.find("input[name='shore-tier']").on("change", function () {
          html.find(".card").removeClass("highlighted");
          const selected = html.find("input[name='shore-tier']:checked").closest(".card");
          selected.addClass("highlighted");
        });

        // Price roll button
        html.find(".roll-price").on("click", async ev => {
          const tier = ev.currentTarget.dataset.tier;
          const entry = tiers.find(t => t.tier === tier);
          if (!entry) return;

          const roll = new Roll(entry.priceFormula);
          await roll.evaluate();
          // Flavorful chat output
          let content = "";
          if (randomFlavor && entry.flavor) {
            const icon = entry.flavor.icon ? `<i class="fas ${entry.flavor.icon}" style="margin-right: 0.5em;"></i>` : "";
            content = `
              <div style="font-weight: bold; font-size: 1.6em; margin-bottom: 0.5em;">${icon}${entry.flavor.label}</div>
              <div style="font-style: italic; font-size: 1.2em;">${entry.flavor.description}</div>
              <hr>
              <div style="font-size: 1.2em; margin-bottom: 0.5em;">${entry.flavor.description}</div>
            `;
          } else {
            content = `Price for ${entry.label}`;
          }
                 
          await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: content});
        });

        // Reroll flavor button
        html.find(".reroll-flavor").on("click", ev => {
          const card = $(ev.currentTarget).closest(".card");
          const tierKey = card.find("input[name='shore-tier']").val();
          const entry = tiers.find(t => t.tier === tierKey);
          if (!entry) return;
        
          // Apply new flavor
          flavorizeShoreLeave(entry);
        
          // Update DOM
          const iconElement = card.find(".icon");
          if (entry.flavor?.icon) {
            iconElement.attr("class", `fas ${entry.flavor.icon} icon`);
          }
        
          const labelContainer = card.find(".flavor-label");
          if (entry.flavor?.label) {
            labelContainer.text(entry.flavor.label);
          }
        
          let descContainer = card.find(".flavor-description");
          if (entry.flavor?.description) {
            descContainer.text(entry.flavor.description);
          }
        });

        // Set dialog width manually for layout stability
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
