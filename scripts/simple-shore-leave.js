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
    const dlg = new Dialog({
      title: "Select Shore Leave Tier",
      content,
      buttons: {}, // Keine Foundry-Buttons
      close: () => resolve(null),
      render: async html => {
        const app = html.closest('.app');
        app.css({ width: '923px', maxWidth: '95vw', margin: '0 auto' });
    
        // Initial-Button-Zustand sperren
        const confirmBtn = html.find("#confirm-button");
        confirmBtn.addClass("locked");
    
        // Auswahlverhalten
        html.find("input[name='shore-tier']").on("change", function () {
          html.find(".card").removeClass("selected");
          const selectedCard = html.find("input[name='shore-tier']:checked").closest(".card");
          selectedCard.addClass("selected");
    
          // Button freischalten
          confirmBtn.removeClass("locked");
        });
    
        // Preiswurf
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
    
        // Flavor-Neu würfeln
        html.find(".reroll-flavor").on("click", ev => {
          const card = $(ev.currentTarget).closest(".card");
          const tierKey = card.find("input[name='shore-tier']").val();
          const entry = tiers.find(t => t.tier === tierKey);
          if (!entry) return;
    
          flavorizeShoreLeave(entry);
    
          card.find(".icon").attr("class", `fas ${entry.flavor.icon} icon`);
          card.find(".flavor-label").text(entry.flavor.label);
          card.find(".flavor-description").text(entry.flavor.description);
        });
    
        // Bestätigen
        confirmBtn.on("click", async () => {
          if (confirmBtn.hasClass("locked")) return;
    
          const selected = html.find("input[name='shore-tier']:checked").val();
          const entry = tiers.find(t => t.tier === selected);
          if (!entry) return ui.notifications.error("Invalid tier selected.");
    
          const result = await convertStress(actor, entry.stressFormula);
          dlg.close();
          resolve(result);
        });
      }
    });
    
    dlg.render(true);
  });
}
