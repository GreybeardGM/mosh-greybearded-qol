import { getThemeColor } from "../utils/get-theme-color.js";
import { loadAllItemsByType } from "../utils/item-loader.js";
import { normalizeName, toSkillId } from "./utils.js";
import { rebuildSkillLineGeometry, updateSkillLineHighlights } from "./skill-tree-renderer.js";

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
      template: "modules/mosh-greybearded-qol/templates/character-creator/select-training-skill.html"
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
      nameLower: normalizeName(skill.name),
      img: skill.img,
      rank: String(skill?.system?.rank ?? "").toLowerCase(),
      system: skill.system
    }));

    const ownedSkillNames = new Set(
      actor.items
        .filter(item => item.type === "skill")
        .map(item => normalizeName(item.name))
    );

    return { sortedSkills, ownedSkillNames };
  }

  constructor({ actor, resolve, sortedSkills, ownedSkillNames }, options = {}) {
    super(options);
    this.actor = actor;
    this._resolve = resolve;
    this._resolved = false;

    this.sortedSkills = sortedSkills;
    this._skillById = new Map(sortedSkills.map(skill => [skill.id, skill]));
    this.ownedSkillNames = ownedSkillNames;
    this._dom = null;
    this._lineDrawFrame = null;
    this._pendingChangedSkillIds = null;
    this._linePathCache = new Map();
    this._lineKeyBySkill = new Map();
    this._needsLineGeometryRebuild = true;

    this._selectedSkillIds = new Set();
    this._selectedNewSkillId = null;
    this._prevSelectedSkills = new Set();
  }

  _getRoot() {
    if (this.element instanceof HTMLElement) return this.element;
    if (this.element?.[0] instanceof HTMLElement) return this.element[0];
    return null;
  }

  _cacheDomReferences(root) {
    const skillCards = Array.from(root.querySelectorAll(".skill-card"));
    const skillCardById = new Map(skillCards.map(el => [el.dataset.skillId, el]));

    this._dom = {
      root,
      cards: skillCards,
      skillCardById,
      svg: root.querySelector("#skill-arrows"),
      confirm: root.querySelector("#confirm-button")
    };
  }

  _initializeSelectionStateFromDom() {
    const cards = this._dom?.cards ?? [];
    this._selectedSkillIds = new Set(cards.filter(el => el.classList.contains("selected")).map(el => el.dataset.skillId));
    this._prevSelectedSkills = new Set(this._selectedSkillIds);
  }

  _applyInitialAvailabilityLock() {
    for (const card of this._dom?.cards ?? []) {
      if (card.classList.contains("default-skill")) continue;

      const skill = this._skillById.get(card.dataset.skillId);
      const prereqIds = (skill?.system?.prerequisite_ids || []).map(toSkillId);
      const isUnlocked = prereqIds.length === 0 || prereqIds.some(id => this._selectedSkillIds.has(id));

      if (!isUnlocked) {
        card.classList.add("locked");
      }
    }
  }

  _scheduleDrawLines({ rebuild = false, changedSkillIds = null } = {}) {
    if (rebuild) this._needsLineGeometryRebuild = true;
    if (changedSkillIds?.size) {
      if (!this._pendingChangedSkillIds) this._pendingChangedSkillIds = new Set();
      for (const skillId of changedSkillIds) this._pendingChangedSkillIds.add(skillId);
    }
    if (this._lineDrawFrame) cancelAnimationFrame(this._lineDrawFrame);
    this._lineDrawFrame = requestAnimationFrame(() => {
      this._lineDrawFrame = null;
      this._drawLines(this._pendingChangedSkillIds);
      this._pendingChangedSkillIds = null;
    });
  }

  _drawLines(changedSkillIds = null) {
    const svg = this._dom?.svg;
    if (!svg) return;

    let rebuiltGeometry = false;
    if (this._needsLineGeometryRebuild || this._linePathCache.size === 0) {
      rebuildSkillLineGeometry({
        svg,
        sortedSkills: this.sortedSkills,
        skillCardById: this._dom.skillCardById,
        toSkillId,
        linePathCache: this._linePathCache,
        lineKeyBySkill: this._lineKeyBySkill
      });

      this._needsLineGeometryRebuild = false;
      rebuiltGeometry = true;
    }

    updateSkillLineHighlights({
      rebuiltGeometry,
      changedSkillIds,
      linePathCache: this._linePathCache,
      lineKeyBySkill: this._lineKeyBySkill,
      selectedSkillIds: this._selectedSkillIds,
      isHighlighted: line => this._selectedSkillIds.has(line.skillId) && this._selectedSkillIds.has(line.prereqId)
    });
  }

  async _prepareContext() {
    return {
      sortedSkills: this.sortedSkills,
      ownedSkillNames: this.ownedSkillNames,
      themeColor: getThemeColor(),
      confirmLocked: true
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this._getRoot();
    if (!root) return;

    this._cacheDomReferences(root);
    this._initializeSelectionStateFromDom();
    this._applyInitialAvailabilityLock();

    root.querySelectorAll(".skill-card img").forEach(img => {
      if (img.complete) return;
      img.addEventListener("load", () => this._scheduleDrawLines({ rebuild: true }), { once: true });
    });

    this._updateConfirmState();
    this._scheduleDrawLines({ rebuild: true });
  }

  _updateConfirmState() {
    const confirm = this._dom?.confirm;
    if (!confirm) return;

    const hasSelection = !!this._selectedNewSkillId;
    confirm.classList.toggle("locked", !hasSelection);
    confirm.disabled = !hasSelection;
    confirm.setAttribute("aria-disabled", String(!hasSelection));
  }

  static async _onToggleSkill(event, target) {
    const skillId = target?.dataset?.skillId;
    if (!skillId) return;
    if (target.classList.contains("default-skill") || target.classList.contains("locked")) return;

    const changed = new Set();
    const isSelected = target.classList.contains("selected");

    for (const card of this._dom.cards) {
      if (card.classList.contains("default-skill")) continue;
      if (card.classList.contains("selected")) changed.add(card.dataset.skillId);
      card.classList.remove("selected");
      this._selectedSkillIds.delete(card.dataset.skillId);
    }

    if (!isSelected) {
      target.classList.add("selected");
      this._selectedSkillIds.add(skillId);
      this._selectedNewSkillId = skillId;
      changed.add(skillId);
    } else {
      this._selectedNewSkillId = null;
      changed.add(skillId);
    }

    for (const id of this._prevSelectedSkills) changed.add(id);
    this._prevSelectedSkills = new Set(this._selectedSkillIds);

    this._updateConfirmState();
    this._scheduleDrawLines({ changedSkillIds: changed });
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
    if (this._lineDrawFrame) {
      cancelAnimationFrame(this._lineDrawFrame);
      this._lineDrawFrame = null;
    }
    this._dom = null;
    this._linePathCache.clear();
    this._lineKeyBySkill.clear();
    this._skillById.clear();
    this._pendingChangedSkillIds = null;
    this._resolveOnce(null);
    return super.close(options);
  }

  _resolveOnce(value) {
    if (this._resolved) return;
    this._resolved = true;
    this._resolve?.(value);
  }
}
