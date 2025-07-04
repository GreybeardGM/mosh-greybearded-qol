import { getThemeColor } from "./utils/get-theme-color.js";
import { toRollFormula } from "./utils/to-roll-formula.js";
import { toRollString } from "./utils/to-roll-string.js";
import { convertStress } from "./convert-stress.js";
import { flavorizeShoreLeave } from "./utils/flavorize-shore-leave.js";
import { chatOutput } from "./utils/chat-output.js";

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
  const content = await renderTemplate("modules/mosh-greybearded-qol/templates/simple-shore-leave.html", {
    tiers,
    themeColor
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
          html.find(".card").removeClass("selected");
          const selected = html.find("input[name='shore-tier']:checked").closest(".card");
          selected.addClass("selected");
        });

        // Price roll button
        html.find(".roll-price").on("click", async ev => {
          const tier = ev.currentTarget.dataset.tier;
          const entry = tiers.find(t => t.tier === tier);
          if (!entry) return;

          const roll = new Roll(entry.priceFormula);
          await roll.evaluate();

          await chatOutput({
            actor,
            title: entry.label,
            subtitle: entry.flavor?.label || "Shore Leave",
            content: entry.flavor?.description || "",
            icon: entry.flavor?.icon || entry.icon,
            roll,
            buttons: [
              {
                label: "Participate Now",
                icon: "fa-dice",
                action: "convertStress",
                args: [entry.stressFormula]
              }
            ]
          });
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
          width: '923px',
          maxWidth: '95vw',
          margin: '0 auto'
        });
      },
      default: "confirm"
    }).render(true);
  });
}
