import { getThemeColor } from "./utils/get-theme-color.js";
import { toRollFormula } from "./utils/to-roll-formula.js";
import { toRollString } from "./utils/to-roll-string.js";
import { convertStress } from "./convert-stress.js";
import { flavorizeShoreLeave } from "./utils/flavorize-shore-leave.js";
import { chatOutput } from "./utils/chat-output.js";

// V2 + Handlebars-Mixin
const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

class ShoreLeaveDialogV2 extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "moshqol-shore-leave",
    classes: ["moshqol","shore-leave"],
    window: { title: "Select Shore Leave Tier", controls: [] }, // keine Header-Buttons
    position: { width: 923 },
    resizable: false
  };

  /** V2: explizit keine Header-Controls zurückgeben */
  _getHeaderControls() { return []; }
  
  // Handlebars-Templates definieren
  static PARTS = Object.freeze({
    body: { id: "body", template: "modules/mosh-greybearded-qol/templates/simple-shore-leave.html" }
  });
  
  /** @param {{actor:Actor, tiers:any[], themeColor:string, onResolve:(v:any)=>void}} opts */
  constructor(opts) {
    super();
    this.actor = opts.actor;
    this.tiers = opts.tiers;
    this.themeColor = opts.themeColor;
    this.onResolve = opts.onResolve;
  }

  // Kontext fürs Template
  async _prepareContext(_options) {
    return { tiers: this.tiers, themeColor: this.themeColor };
  }

  // HTMLElement-Listener (kein jQuery)
  _attachListeners(html) {
    const root = html; // HTMLElement der App
    root.style.maxWidth = "95vw";
    root.style.margin = "0 auto";

    const confirmBtn = root.querySelector("#confirm-button");
    if (confirmBtn) { confirmBtn.classList.add("locked"); } else { return; } // hart abbrechen, wenn Template nicht passt

    // Auswahl
    root.querySelectorAll("input[name='shore-tier']").forEach(r => {
      r.addEventListener("change", () => {
        root.querySelectorAll(".card.selected").forEach(c => c.classList.remove("selected"));
        const selectedCard = r.closest(".card");
        if (selectedCard) selectedCard.classList.add("selected");
        if (confirmBtn) confirmBtn.classList.remove("locked");
      });
    });

    // Preiswurf
    root.querySelectorAll(".roll-price").forEach(btn => {
      btn.addEventListener("click", async ev => {
        const tierKey = ev.currentTarget.dataset.tier;
        const entry = this.tiers.find(t => t.tier === tierKey);
        if (!entry) return;
        const roll = new Roll(entry.priceFormula); await roll.evaluate();

        await chatOutput({
          actor: this.actor,
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
        const entry = this.tiers.find(t => t.tier === tierKey);
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
        const entry = this.tiers.find(t => t.tier === selected);
        if (!entry) { ui.notifications.error("Invalid tier selected."); return; }
        const result = await convertStress(this.actor, entry.stressFormula);
        this.onResolve?.(result);
        this.close();
      });
    }
  }
}

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
  
  return await new Promise(resolve => {
    const app = new ShoreLeaveDialogV2({ actor, tiers, themeColor, onResolve: resolve });
    app.render(true);
  });

}
