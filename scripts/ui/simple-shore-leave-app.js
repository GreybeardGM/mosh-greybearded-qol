import { convertStress } from "../convert-stress.js";
import { flavorizeShoreLeave } from "../utils/flavorize-shore-leave.js";
import { chatOutput } from "../utils/chat-output.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SimpleShoreLeaveApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "simple-shore-leave",
    tag: "div",
    window: {
      title: "Select Shore Leave Tier",
      resizable: true
    },
    position: {
      width: 923,
      height: "auto"
    }
  });

  static PARTS = {
    content: {
      template: "modules/mosh-greybearded-qol/templates/simple-shore-leave.html"
    }
  };

  static wait({ actor, tiers, themeColor }) {
    return new Promise(resolve => {
      const app = new this({ actor, tiers, themeColor, resolve });
      app.render(true);
    });
  }

  constructor({ actor, tiers, themeColor, resolve }, options = {}) {
    super(options);
    this.actor = actor;
    this.tiers = tiers;
    this.themeColor = themeColor;
    this._selectedTier = null;
    this._resolve = resolve;
    this._resolved = false;
  }

  async _prepareContext() {
    return {
      tiers: this.tiers,
      themeColor: this.themeColor
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = $(this.element);
    const confirmBtn = html.find("#confirm-button");
    confirmBtn.addClass("locked");

    html.find("input[name='shore-tier']").on("change", ev => {
      this._selectedTier = ev.currentTarget.value;
      html.find(".card").removeClass("selected");
      $(ev.currentTarget).closest(".card").addClass("selected");
      confirmBtn.removeClass("locked");
    });

    html.find(".roll-price").on("click", async ev => {
      const tier = ev.currentTarget.dataset.tier;
      const entry = this.tiers.find(t => t.tier === tier);
      if (!entry) return;

      const roll = new Roll(entry.priceFormula);
      await roll.evaluate();

      await chatOutput({
        actor: this.actor,
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

    html.find(".reroll-flavor").on("click", ev => {
      const card = $(ev.currentTarget).closest(".card");
      const tierKey = card.find("input[name='shore-tier']").val();
      const entry = this.tiers.find(t => t.tier === tierKey);
      if (!entry) return;

      flavorizeShoreLeave(entry);

      card.find(".icon").attr("class", `fas ${entry.flavor.icon} icon`);
      card.find(".flavor-label").text(entry.flavor.label);
      card.find(".flavor-description").text(entry.flavor.description);
    });

    confirmBtn.on("click", async () => {
      if (confirmBtn.hasClass("locked")) return;

      const entry = this.tiers.find(t => t.tier === this._selectedTier);
      if (!entry) return ui.notifications.error("Invalid tier selected.");

      const result = await convertStress(this.actor, entry.stressFormula);
      this._resolveOnce(result);
      await this.close();
    });
  }

  async close(options = {}) {
    this._resolveOnce(null);
    return super.close(options);
  }

  _resolveOnce(value) {
    if (this._resolved) return;
    this._resolved = true;
    this._resolve?.(value);
  }
}
