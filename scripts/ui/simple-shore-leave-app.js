import { convertStress } from "../convert-stress.js";
import { flavorizeShoreLeave } from "../utils/flavorize-shore-leave.js";
import { chatOutput } from "../utils/chat-output.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SimpleShoreLeaveApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "simple-shore-leave",
    window: {
      title: "Select Shore Leave Tier",
      resizable: false
    },
    position: {
      width: 923,
      height: "auto"
    },
    actions: {
      selectTier: this._onSelectTier,
      rollPrice: this._onRollPrice,
      rerollFlavor: this._onRerollFlavor,
      confirm: this._onConfirm
    }
  };

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
      tiers: this.tiers.map(tier => ({
        ...tier,
        selected: tier.tier === this._selectedTier
      })),
      themeColor: this.themeColor,
      confirmLocked: !this._selectedTier
    };
  }

  static _onSelectTier(event, target) {
    this._selectedTier = target.value;
    this.render();
  }

  static async _onRollPrice(event, target) {
    const tier = target.dataset.tier;
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
  }

  static _onRerollFlavor(event, target) {
    const tier = target.dataset.tier;
    const entry = this.tiers.find(t => t.tier === tier);
    if (!entry) return;

    flavorizeShoreLeave(entry);
    this.render();
  }

  static async _onConfirm() {
    const entry = this.tiers.find(t => t.tier === this._selectedTier);
    if (!entry) return ui.notifications.error("Invalid tier selected.");

    const result = await convertStress(this.actor, entry.stressFormula);
    this._resolveOnce(result);
    await this.close();
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
