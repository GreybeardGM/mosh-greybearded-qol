import {
  MODULE_ID,
  SETTING_SIMPLE_SHORE_LEAVE_DISABLE_FLAVOR,
  templatePath
} from "../codex/constants.js";
import { convertStress } from "./convert-stress.js";
import { flavorizeShoreLeave } from "./flavorize-shore-leave.js";
import { chatOutput } from "../utils/chat-output.js";
import { getNormalizedShoreLeaveConfig } from "../settings/shore-leave-config.js";
import { toRollFormula, toRollString } from "../utils/to-roll-formula.js";
import { formatCurrency, parseCurrencyValue } from "../utils/normalization.js";
import { appendQolThemeContext, createQolAppDefaultOptions } from "../utils/application-options.js";
import { getAppRoot, resolveAppOnce } from "../utils/application-helpers.js";
import { scheduleAutoTrainingAfterShoreLeave } from "../training/training-action.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SimpleShoreLeave extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createQolAppDefaultOptions({
    id: "simple-shore-leave",
    title: "MoshQoL.ShoreLeave.SelectTier",
    window: { icon: "fas fa-umbrella-beach" },
    form: { handler: this._onSubmit },
    actions: {
      selectTier: this._onSelectTier,
      rollPrice: this._onRollPrice,
      rerollFlavor: this._onRerollFlavor
    }
  });

  static PARTS = {
    form: {
      template: templatePath("dialogs/simple-shore-leave.html")
    },
    confirm: {
      template: templatePath("ui/confirm-button.html")
    }
  };

  static wait({ actor, randomFlavor }) {
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Errors.NoActorProvided"));
      return null;
    }

    return new Promise(resolve => {
      const app = new this({ actor, randomFlavor, resolve });
      app.render(true);
    });
  }

  constructor({ actor, randomFlavor, resolve }, options = {}) {
    super(options);
    this.actor = actor;
    this._resolve = resolve;
    this._resolved = false;
    this._selectedTier = null;

    const shoreLeaveConfig = getNormalizedShoreLeaveConfig();
    const flavorDisabled = game.settings.get(MODULE_ID, SETTING_SIMPLE_SHORE_LEAVE_DISABLE_FLAVOR);
    this.randomFlavor = flavorDisabled ? false : (randomFlavor ?? shoreLeaveConfig.simpleShoreLeave.randomFlavor);
    this.tiers = this._loadTiers();
    this.tierById = new Map(this.tiers.map(tier => [tier.tier, tier]));
  }

  _loadTiers() {
    const config = getNormalizedShoreLeaveConfig().tiers;
    return Object.values(config).map(tier => {
      const base = {
        tier: tier.tier,
        label: tier.label,
        icon: tier.icon ?? null,
        stressFormula: toRollFormula(tier.baseStressConversion),
        stressString: toRollString(tier.baseStressConversion),
        priceFormula: toRollFormula(tier.basePrice),
        priceString: toRollString(tier.basePrice),
        raw: tier
      };
      if (this.randomFlavor) flavorizeShoreLeave(base);
      return base;
    });
  }

  _getTier(tierKey) {
    return this.tierById.get(tierKey);
  }

  _updateSelectionUi() {
    const root = getAppRoot(this.element);
    if (!root) return;

    root.querySelectorAll(".card").forEach(card => {
      const isSelected = card.dataset.tier === this._selectedTier;
      card.classList.toggle("selected", isSelected);

      const input = card.querySelector("input[name='shore-tier']");
      if (input) input.checked = isSelected;
    });

    const confirm = root.querySelector("#confirm-button");
    if (!confirm) return;

    const locked = !this._selectedTier;
    confirm.classList.toggle("locked", locked);
    confirm.disabled = locked;
  }

  async _prepareContext() {
    return appendQolThemeContext({
      tiers: this.tiers.map(tier => ({
        ...tier,
        selected: tier.tier === this._selectedTier
      })),
      confirmLocked: !this._selectedTier
    });
  }

  static _onSelectTier(event, target) {
    const nextTier = target.dataset.tier ?? target.value;
    if (!nextTier || nextTier === this._selectedTier) return;

    this._selectedTier = nextTier;
    // Selection ist ein leichter UI-Update und braucht kein komplettes Re-Render.
    this._updateSelectionUi();
  }

  static async _onRollPrice(event, target) {
    const tier = target.dataset.tier;
    const entry = this._getTier(tier);
    if (!entry) return;

    const roll = new Roll(entry.priceFormula);
    await roll.evaluate();
    const rolledPrice = parseCurrencyValue(roll.total);
    const formattedPrice = formatCurrency(rolledPrice);

    await chatOutput({
      actor: this.actor,
      title: entry.label,
      subtitle: entry.flavor?.label || game.i18n.localize("MoshQoL.Common.ShoreLeave"),
      blocks: [
        ...(entry.flavor?.description ? [{ type: "text", text: entry.flavor.description }] : []),
        {
          type: "counter",
          label: game.i18n.localize("MoshQoL.ShoreLeave.PayablePrice"),
          value: formattedPrice
        }
      ],
      icon: entry.flavor?.icon || entry.icon,
      roll,
      buttons: [
        {
          label: game.i18n.localize("MoshQoL.ShoreLeave.PayUp"),
          icon: "fa-coins",
          action: "payShoreLeave",
          args: [rolledPrice]
        },
        {
          label: game.i18n.localize("MoshQoL.ShoreLeave.ParticipateNow"),
          icon: "fa-dice",
          action: "convertStress",
          args: [entry.stressFormula]
        }
      ]
    });
  }

  static _onRerollFlavor(event, target) {
    // Flavor reroll soll die Tier-Auswahl nicht verändern.
    event.preventDefault();
    event.stopPropagation();

    const tier = target.dataset.tier;
    const entry = this._getTier(tier);
    if (!entry) return;

    flavorizeShoreLeave(entry);

    // Nur die betroffene Card aktualisieren statt kompletter App-Re-Render.
    const card = target.closest(".card");
    if (!card) return;

    const iconEl = card.querySelector(".icon");
    if (iconEl) {
      const iconClass = entry.flavor?.icon || entry.icon;
      if (iconClass) iconEl.className = `fas ${iconClass} icon`;
    }

    const flavorLabel = card.querySelector(".flavor-label");
    if (flavorLabel) flavorLabel.textContent = entry.flavor?.label || "";

    const flavorDescription = card.querySelector(".flavor-description");
    if (flavorDescription) flavorDescription.textContent = entry.flavor?.description || "";
  }

  static async _onSubmit(event, form, formData) {
    const selectedTier = formData.object?.["shore-tier"] ?? this._selectedTier;
    const entry = this._getTier(selectedTier);
    if (!entry) return ui.notifications.error(game.i18n.localize("MoshQoL.ShoreLeave.InvalidTier"));

    const result = await convertStress(this.actor, entry.stressFormula);
    resolveAppOnce(this, result);
    scheduleAutoTrainingAfterShoreLeave(this.actor);
  }

  async close(options = {}) {
    resolveAppOnce(this, null);
    return super.close(options);
  }

}
