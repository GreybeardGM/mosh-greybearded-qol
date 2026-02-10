import { getThemeColor } from "../utils/get-theme-color.js";
import { loadAllItemsByType } from "../utils/item-loader.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TrainingSkillSelectorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "character-training-select-skill",
    tag: "form",
    window: {
      title: "Training",
      contentClasses: ["greybeardqol", "skill-selection", "training-selection"],
      resizable: false
    },
    position: {
      width: 1200,
      height: "auto"
    },
    form: {
      handler: this._onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      toggleSkill: this._onToggleSkill
    }
  };

  static PARTS = {
    main: {
      template: "modules/mosh-greybearded-qol/templates/dialogs/training-select-skill.html"
    },
    confirm: {
      template: "modules/mosh-greybearded-qol/templates/ui/confirm-button.html"
    }
  };

  static async wait({ actor }) {
    const prep = await this._prepareData({ actor });
    return new Promise(resolve => {
      const app = new this({ actor, resolve, ...prep });
      app.render(true);
    });
  }

  static async _prepareData({ actor }) {
    const allSkills = await loadAllItemsByType("skill");
    const sortedSkills = allSkills.map(skill => ({
      id: skill.id,
      _id: skill.id,
      uuid: skill.uuid,
      name: skill.name,
      img: skill.img,
      rank: String(skill?.system?.rank ?? "").toLowerCase(),
      system: skill.system
    }));

    const ownedSkillIds = new Set(
      actor.items
        .filter(item => item.type === "skill")
        .map(item => item.id)
    );

    return { sortedSkills, ownedSkillIds };
  }

  constructor({ actor, resolve, sortedSkills, ownedSkillIds }, options = {}) {
    super(options);
    this.actor = actor;
    this._resolve = resolve;
    this._resolved = false;

    this.sortedSkills = sortedSkills;
    this.ownedSkillIds = ownedSkillIds;

    this._dom = null;
    this._selectedNewSkillId = null;
  }

  _getRoot() {
    if (this.element instanceof HTMLElement) return this.element;
    if (this.element?.[0] instanceof HTMLElement) return this.element[0];
    return null;
  }

  async _prepareContext() {
    return {
      sortedSkills: this.sortedSkills,
      ownedSkillIds: this.ownedSkillIds,
      themeColor: getThemeColor()
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this._getRoot();
    if (!root) return;

    this._dom = {
      cards: Array.from(root.querySelectorAll(".skill-card")),
      confirm: root.querySelector("#confirm-button")
    };

    this._updateConfirmState();
  }

  _updateConfirmState() {
    const confirm = this._dom?.confirm;
    if (!confirm) return;

    const hasSelection = !!this._selectedNewSkillId;
    confirm.classList.toggle("locked", !hasSelection);
    confirm.setAttribute("aria-disabled", String(!hasSelection));
  }

  static async _onToggleSkill(event, target) {
    const skillId = target?.dataset?.skillId;
    if (!skillId) return;
    if (target.classList.contains("default-skill")) return;

    const isSelected = target.classList.contains("selected");
    for (const card of this._dom.cards) {
      if (card.classList.contains("default-skill")) continue;
      card.classList.remove("selected");
    }

    if (!isSelected) {
      target.classList.add("selected");
      this._selectedNewSkillId = skillId;
    } else {
      this._selectedNewSkillId = null;
    }

    this._updateConfirmState();
  }

  static async _onSubmit() {
    const confirm = this._dom?.confirm;
    if (!confirm || confirm.classList.contains("locked")) return;

    const selectedCard = this._dom.cards.find(el => el.dataset.skillId === this._selectedNewSkillId);
    const selectedUuid = selectedCard?.dataset?.uuid;
    if (!selectedUuid) {
      this._resolveOnce(null);
      return;
    }

    const selectedItem = await fromUuid(selectedUuid);
    if (!selectedItem || selectedItem.type !== "skill") {
      ui.notifications?.warn("Selected training skill could not be loaded.");
      this._resolveOnce(null);
      return;
    }

    const itemData = selectedItem.toObject();
    delete itemData._id;

    const [created] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    this._resolveOnce(created ?? null);
  }

  async close(options = {}) {
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
