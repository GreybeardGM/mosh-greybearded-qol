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
    this._boundContextMenu = null;
    this._dom = null;

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

  _getElementRoot() {
    if (this.element instanceof HTMLElement) return this.element;
    if (this.element?.[0] instanceof HTMLElement) return this.element[0];
    return null;
  }

  _cacheDomReferences(root) {
    this._dom = {
      remaining: root.querySelector("#remaining"),
      confirmBtn: root.querySelector("#confirm-button"),
      counters: {
        sanity: root.querySelector("[data-counter='sanity']"),
        fear: root.querySelector("[data-counter='fear']"),
        body: root.querySelector("[data-counter='body']")
      },
      inputs: {
        sanity: root.querySelector("input[name='sanity']"),
        fear: root.querySelector("input[name='fear']"),
        body: root.querySelector("input[name='body']")
      }
    };
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
    const root = this._getElementRoot();
    if (!root) return;

    this._cacheDomReferences(root);

    // Delegation: pro Render genau ein Contextmenu-Handler am Root.
    if (this._boundContextMenu) {
      root.removeEventListener("contextmenu", this._boundContextMenu);
    }
    this._boundContextMenu = ev => {
      const card = ev.target.closest(".card[data-attr]");
      if (!card || !root.contains(card)) return;
      ev.preventDefault();

      const attr = card.dataset.attr;
      if (!attr || this.values[attr] <= this.base[attr]) return;
      this.values[attr] -= 1;
      this._updateUi();
    };
    root.addEventListener("contextmenu", this._boundContextMenu);
  }

  _updateUi() {
    const dom = this._dom;
    if (!dom) return;

    for (const attr of Object.keys(this.values)) {
      const value = this.values[attr];
      const diff = value - this.base[attr];

      const counter = dom.counters[attr];
      if (counter) {
        counter.innerHTML = diff > 0 ? `${value} <span class="bonus">[+${diff}]</span>` : `${value}`;
      }

      const hiddenInput = dom.inputs[attr];
      if (hiddenInput) hiddenInput.value = String(value);
    }

    if (dom.remaining) dom.remaining.textContent = String(this.points - this._assignedPoints);

    if (!dom.confirmBtn) return;
    const locked = this._assignedPoints !== this.points;
    dom.confirmBtn.classList.toggle("locked", locked);
    dom.confirmBtn.disabled = locked;
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
    const root = this._getElementRoot();
    if (root && this._boundContextMenu) {
      root.removeEventListener("contextmenu", this._boundContextMenu);
    }
    this._boundContextMenu = null;
    this._dom = null;

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
