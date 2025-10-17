import { getThemeColor } from "./utils/get-theme-color.js";
import { toRollFormula } from "./utils/to-roll-formula.js";
import { toRollString } from "./utils/to-roll-string.js";
import { convertStress } from "./convert-stress.js";
import { flavorizeShoreLeave } from "./utils/flavorize-shore-leave.js";
import { chatOutput } from "./utils/chat-output.js";

const { DialogV2 } = foundry.applications.api;

export async function simpleShoreLeave(actor, randomFlavor) {
  if (!actor) { ui.notifications.warn("No actor provided."); return null; }

  const flavorDisabled = game.settings.get("mosh-greybearded-qol", "simpleShoreLeave.disableFlavor");
  randomFlavor = flavorDisabled ? false : (randomFlavor ?? game.settings.get("mosh-greybearded-qol", "simpleShoreLeave.randomFlavor"));

  const config = game.settings.get("mosh-greybearded-qol", "shoreLeaveTiers");
  const tiers = Object.values(config).map(tier => {
    const base = {
      tier: tier.tier,
      label: tier.label,
      icon: tier.icon ?? null,
      stressFormula: toRollFormula(tier.baseStressConversion),
      stressString:  toRollString(tier.baseStressConversion),
      priceFormula:  toRollFormula(tier.basePrice),
      priceString:   toRollString(tier.basePrice),
      raw: tier
    };
    if (randomFlavor) flavorizeShoreLeave(base);
    return base;
  });

  const themeColor = getThemeColor();
  const content = await foundry.applications.handlebars.renderTemplate(
    "modules/mosh-greybearded-qol/templates/simple-shore-leave.html",
    { tiers, themeColor }
  );

  let selectedTierKey = null;
  let resolved = null;

  return await DialogV2.wait({
    window: { title: "Select Shore Leave Tier" },

    // WICHTIG: Mindestens 1 Button definieren
    buttons: [
      {
        label: "Confirm",
        action: "confirm",
        default: true,
        callback: async () => {
          if (!selectedTierKey) { ui.notifications.error("Select a tier first."); return; }
          const entry = tiers.find(t => t.tier === selectedTierKey);
          if (!entry) { ui.notifications.error("Invalid tier selected."); return; }
          resolved = await convertStress(actor, entry.stressFormula);
          return resolved; // optional
        }
      },
      { label: "Close", action: "close" }
    ],

    // V13: Signatur ist (app, html)
    render: (app, html /* HTMLElement */) => {
      // Layout
      html.style.maxWidth = "95vw";
      html.style.margin = "0 auto";

      // Auswahl-Handling (Radiobuttons)
      html.querySelectorAll("input[name='shore-tier']").forEach(radio => {
        radio.addEventListener("change", () => {
          html.querySelectorAll(".card.selected").forEach(c => c.classList.remove("selected"));
          const card = radio.closest(".card");
          if (card) card.classList.add("selected");
          selectedTierKey = radio.value;
        }, { passive: true });
      });

      // Preiswurf
      html.querySelectorAll(".roll-price").forEach(btn => {
        btn.addEventListener("click", async ev => {
          const tierKey = ev.currentTarget?.dataset?.tier;
          const entry = tiers.find(t => t.tier === tierKey);
          if (!entry) return;
          const roll = new Roll(entry.priceFormula); await roll.evaluate();
          await chatOutput({
            actor,
            title: entry.label,
            subtitle: entry.flavor?.label || "Shore Leave",
            content: entry.flavor?.description || "",
            icon: entry.flavor?.icon || entry.icon,
            roll,
            buttons: [{ label: "Participate Now", icon: "fa-dice", action: "convertStress", args: [entry.stressFormula] }]
          });
        }, { passive: true });
      });

      // Flavor neu würfeln (UI im Inhalt updaten)
      html.querySelectorAll(".reroll-flavor").forEach(btn => {
        btn.addEventListener("click", ev => {
          const card = ev.currentTarget.closest(".card");
          const key = card.querySelector("input[name='shore-tier']")?.value;
          const entry = tiers.find(t => t.tier === key);
          if (!entry) return;

          flavorizeShoreLeave(entry);
          card.querySelector(".icon")?.setAttribute("class", `fas ${entry.flavor.icon} icon`);
          const l = card.querySelector(".flavor-label"); if (l) l.textContent = entry.flavor.label;
          const d = card.querySelector(".flavor-description"); if (d) d.textContent = entry.flavor.description;
        }, { passive: true });
      });
    },

    // Rückgabe beim Schließen steuern
    close: () => resolved,

    // Inhalt übernehmen (bleibt 1:1, kein Sanitizing-Problem, solange Template korrekt ist)
    content
  });
}
