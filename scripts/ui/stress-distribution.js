import { getThemeColor } from "../utils/get-theme-color.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class StressDistributionApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "stress-distribution",
    tag: "form",
    window: {
      title: "Distribute Stress Conversion",
      contentClasses: ["greybeardqol", "stress-conversion-form"],
      resizable: false
    },
    position: {
      width: 512,
      height: "auto"
    },
    form: {
      handler: this._onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      incrementAttr: this._onIncrementAttr
    }
  };

  static PARTS = {
    form: {
      template: "modules/mosh-greybearded-qol/templates/stress-conversion.html"
    }
  };

  static wait({ actor, points }) {
    return new Promise(resolve => {
      const app = new this({ actor, points, resolve });
      app.render(true);
    });
  }

  constructor({ actor, points, resolve }, options = {}) {
    super(options);
    this.actor = actor;
    this.points = points;
    this._resolve = resolve;
    this._resolved = false;

    this.base = {
      sanity: actor.system.stats.sanity.value ?? 0,
      fear: actor.system.stats.fear.value ?? 0,
      body: actor.system.stats.body.value ?? 0
    };
    this.values = structuredClone(this.base);
    this.themeColor = getThemeColor();
  }

  get _assignedPoints() {
    return (this.values.sanity + this.values.fear + this.values.body) - (this.base.sanity + this.base.fear + this.base.body);
  }

  async _prepareContext() {
    const attrs = ["sanity", "fear", "body"].map(attr => {
      const baseValue = this.base[attr];
      const currentValue = this.values[attr];
      const diff = currentValue - baseValue;
      return {
        attr,
        label: attr[0].toUpperCase() + attr.slice(1),
        icon: `systems/mosh/images/icons/ui/attributes/${attr}.png`,
        value: currentValue,
        diff,
        diffText: diff > 0 ? `+${diff}` : ""
      };
    });

    return {
      attrs,
      themeColor: this.themeColor,
      remaining: this.points - this._assignedPoints,
      confirmLocked: this._assignedPoints !== this.points
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
    if (!root) return;

    root.querySelectorAll(".card[data-attr]").forEach(card => {
      card.addEventListener("contextmenu", ev => {
        ev.preventDefault();
        const attr = card.dataset.attr;
        if (!attr || this.values[attr] <= this.base[attr]) return;
        this.values[attr] -= 1;
        this._updateUi();
      });
    });
  }

  _updateUi() {
    const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
    if (!root) return;

    for (const attr of Object.keys(this.values)) {
      const value = this.values[attr];
      const diff = value - this.base[attr];
      const counter = root.querySelector(`[data-counter='${attr}']`);
      if (counter) {
        counter.innerHTML = diff > 0 ? `${value} <span class="bonus">[+${diff}]</span>` : `${value}`;
      }

      const hiddenInput = root.querySelector(`input[name='${attr}']`);
      if (hiddenInput) hiddenInput.value = String(value);
    }

    const remaining = root.querySelector("#remaining");
    if (remaining) remaining.textContent = String(this.points - this._assignedPoints);

    const confirmBtn = root.querySelector("#confirm-button");
    if (!confirmBtn) return;
    const locked = this._assignedPoints !== this.points;
    confirmBtn.classList.toggle("locked", locked);
    confirmBtn.disabled = locked;
  }

  static _onIncrementAttr(event, target) {
    const attr = target.dataset.attr;
    if (!attr) return;

    if (this._assignedPoints < this.points && this.values[attr] < 90) {
      this.values[attr] += 1;
      this._updateUi();
    }
  }

  static async _onSubmit(event, form, formData) {
    if (this._assignedPoints !== this.points) return;

    this._resolveOnce({
      sanity: this.values.sanity,
      fear: this.values.fear,
      body: this.values.body
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

export async function showStressConversionDialog(actor, points) {
  return StressDistributionApp.wait({ actor, points });
}
