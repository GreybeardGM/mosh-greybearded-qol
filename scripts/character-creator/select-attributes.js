import { getThemeColor } from "../utils/get-theme-color.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AttributeSelectorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "character-creator-select-attributes",
    tag: "form",
    window: {
      title: "MoshQoL.CharacterCreator.SelectAttributes.Title",
      contentClasses: ["greybeardqol", "attribute-selection"],
      resizable: false
    },
    position: {
      width: "auto",
      height: "auto"
    },
    form: {
      handler: this._onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      selectAttribute: this._onSelectAttribute
    }
  };

  static PARTS = {
    form: {
      template: "modules/mosh-greybearded-qol/templates/character-creator/select-attributes.html"
    },
    confirm: {
      template: "modules/mosh-greybearded-qol/templates/ui/confirm-button.html"
    }
  };

  static wait({ actor, attributeChoices }) {
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Errors.NoActorProvided"));
      return null;
    }

    return new Promise(resolve => {
      const app = new this({ actor, attributeChoices, resolve });
      app.render(true);
    });
  }

  constructor({ actor, attributeChoices, resolve }, options = {}) {
    super(options);
    this.actor = actor;
    this._resolve = resolve;
    this._resolved = false;

    this.attributeSets = attributeChoices.map(choice => ({
      modification: parseInt(choice.modification, 10) || 0,
      stats: choice.stats
    }));

    this.themeColor = getThemeColor();
    this._selectedBySet = new Map();
  }

  _getElementRoot() {
    if (this.element instanceof HTMLElement) return this.element;
    if (this.element?.[0] instanceof HTMLElement) return this.element[0];
    return null;
  }

  _updateSelectionUi() {
    const root = this._getElementRoot();
    if (!root) return;

    root.querySelectorAll(".attribute-set").forEach(set => {
      const setIndex = Number(set.dataset.setIndex);
      const selectedAttr = this._selectedBySet.get(setIndex);

      set.querySelectorAll(".card").forEach(card => {
        const isSelected = card.dataset.attr === selectedAttr;
        card.classList.toggle("selected", isSelected);
      });
    });

    const confirm = root.querySelector("#confirm-button");
    if (!confirm) return;

    const locked = this._selectedBySet.size !== this.attributeSets.length;
    confirm.classList.toggle("locked", locked);
    confirm.disabled = locked;
  }

  async _prepareContext() {
    return {
      attributeSets: this.attributeSets,
      themeColor: this.themeColor,
      confirmLocked: true
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const root = this._getElementRoot();
    if (!root) return;

    const wrapper = root.closest(".app");
    if (wrapper) {
      wrapper.style.width = "auto";
      wrapper.style.maxWidth = "95vw";
      wrapper.style.margin = "0 auto";
    }

    this._updateSelectionUi();
  }

  static _onSelectAttribute(event, target) {
    const parent = target.closest(".attribute-set");
    if (!parent) return;

    const setIndex = Number(parent.dataset.setIndex);
    const attr = target.dataset.attr;
    if (!Number.isInteger(setIndex) || !attr) return;

    this._selectedBySet.set(setIndex, attr);
    this._updateSelectionUi();
  }

  static async _onSubmit(event, form, formData) {
    const selections = this.attributeSets.map((set, setIndex) => {
      const attr = this._selectedBySet.get(setIndex);
      if (!attr) return null;
      return {
        attr,
        mod: parseInt(set.modification, 10) || 0
      };
    }).filter(Boolean);

    if (selections.length !== this.attributeSets.length) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.SelectAttributes.MustSelectOnePerSet"));
      return;
    }

    for (const { attr, mod } of selections) {
      const current = foundry.utils.getProperty(this.actor.system, `stats.${attr}.value`) || 0;
      await this.actor.update({ [`system.stats.${attr}.value`]: current + mod });
    }

    this._resolveOnce(selections);
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
