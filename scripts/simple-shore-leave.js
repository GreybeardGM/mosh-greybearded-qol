import { getThemeColor } from "./utils/get-theme-color.js";
import { toRollFormula } from "./utils/to-roll-formula.js";
import { toRollString } from "./utils/to-roll-string.js";
import { convertStress } from "./convert-stress.js";
import { flavorizeShoreLeave } from "./utils/flavorize-shore-leave.js";
import { chatOutput } from "./utils/chat-output.js";

const { DialogV2 } = foundry.applications.api;

export async function simpleShoreLeave(actor, randomFlavor) {
  if (!actor) return ui.notifications.warn("No actor provided.");

  const flavorDisabled = game.settings.get("mosh-greybearded-qol", "simpleShoreLeave.disableFlavor");
  randomFlavor = flavorDisabled ? false : (randomFlavor ?? game.settings.get("mosh-greybearded-qol", "simpleShoreLeave.randomFlavor"));

  // Config laden → Tiers bauen
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

  // DialogV2: kein Footer-Button, wir verdrahten alles innerhalb von render(html)
  let resolved = null;
  return await DialogV2.wait({
    window: { title: "Select Shore Leave Tier" },
    content,
    buttons: [
      { label: "Close", action: "close", default: true }   // Pflichtbutton für V2
    ],
    close: () => resolved,                                  // Rückgabe steuern
    render: (root /* HTMLElement */) => {
      root.style.maxWidth = "95vw";
      root.style.margin = "0 auto";

      const confirmBtn = root.querySelector("#confirm-button");
      if (confirmBtn) confirmBtn.classList.add("locked");

      // Auswahl
      root.querySelectorAll("input[name='shore-tier']").forEach(r => {
        r.addEventListener("change", () => {
          root.querySelectorAll(".card.selected").forEach(c => c.classList.remove("selected"));
          const selectedCard = r.closest(".card");
          if (selectedCard) selectedCard.classList.add("selected");
          if (confirmBtn) confirmBtn.classList.remove("locked");
        }, { passive: true });
      });

      // Preiswurf
      root.querySelectorAll(".roll-price").forEach(btn => {
        btn.addEventListener("click", async ev => {
          const tierKey = ev.currentTarget?.dataset?.tier;
          const entry = tiers.find(t => t.tier === tierKey);
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
            buttons: [{ label: "Participate Now", icon: "fa-dice", action: "convertStress", args: [entry.stressFormula] }]
          });
        }, { passive: true });
      });

      // Flavor neu würfeln
      root.querySelectorAll(".reroll-flavor").forEach(btn => {
        btn.addEventListener("click", ev => {
          const card = ev.currentTarget.closest(".card");
          const tierKey = card.querySelector("input[name='shore-tier']")?.value;
          const entry = tiers.find(t => t.tier === tierKey);
          if (!entry) return;

          flavorizeShoreLeave(entry);
          card.querySelector(".icon")?.setAttribute("class", `fas ${entry.flavor.icon} icon`);
          const l = card.querySelector(".flavor-label"); if (l) l.textContent = entry.flavor.label;
          const d = card.querySelector(".flavor-description"); if (d) d.textContent = entry.flavor.description;
        }, { passive: true });
      });

      // Bestätigen
      if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
          if (confirmBtn.classList.contains("locked")) return;

          const selected = root.querySelector("input[name='shore-tier']:checked")?.value;
          const entry = tiers.find(t => t.tier === selected);
          if (!entry) { ui.notifications.error("Invalid tier selected."); return; }

          const result = await convertStress(actor, entry.stressFormula);

          // Dialog schließen; DialogV2.wait resolved auf Close → Rückgabe via result
          const app = root.closest(".app")?.dataset?.appid && ui.windows?.[root.closest(".app").dataset.appid];
          if (app) app.close();

          // Ergebnis an Chat + Rückgabe
          return result;
        });
      }
    }
  });
}
