import { getThemeColor } from "../utils/get-theme-color.js";
import { loadAllItemsByType } from "../utils/item-loader.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const toSkillId = value => String(value ?? "").split(".").pop();
const normalizeName = value => String(value ?? "").trim().toLowerCase();

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
    this.ownedSkillNames = ownedSkillNames;
    this._dom = null;
    this._lineDrawFrame = null;
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

  _scheduleDrawLines({ rebuild = false, changedSkillIds = null } = {}) {
    if (rebuild) this._needsLineGeometryRebuild = true;
    if (this._lineDrawFrame) cancelAnimationFrame(this._lineDrawFrame);
    this._lineDrawFrame = requestAnimationFrame(() => {
      this._lineDrawFrame = null;
      this._drawLines(changedSkillIds);
    });
  }

  _drawLines(changedSkillIds = null) {
    const root = this._getRoot();
    if (root) this._cacheDomReferences(root);

    const svg = this._dom?.svg;
    if (!svg) return;

    let rebuiltGeometry = false;
    if (this._needsLineGeometryRebuild || this._linePathCache.size === 0) {
      this._linePathCache.clear();
      this._lineKeyBySkill.clear();
      svg.innerHTML = "";

      const parentRect = svg.getBoundingClientRect();
      const frag = document.createDocumentFragment();

      for (const skill of this.sortedSkills) {
        const prereqIds = (skill.system?.prerequisite_ids || []).map(toSkillId);
        for (const prereqId of prereqIds) {
          const fromEl = this._dom.skillCardById.get(prereqId);
          const toEl = this._dom.skillCardById.get(skill.id);
          if (!fromEl || !toEl) continue;

          const rect1 = fromEl.getBoundingClientRect();
          const rect2 = toEl.getBoundingClientRect();

          const relX1 = rect1.left + rect1.width - parentRect.left;
          const relY1 = rect1.top + rect1.height / 2 - parentRect.top;
          const relX2 = rect2.left - parentRect.left;
          const relY2 = rect2.top + rect2.height / 2 - parentRect.top;

          const deltaX = Math.abs(relX2 - relX1) / 2;
          const pathData = `M ${relX1},${relY1} C ${relX1 + deltaX},${relY1} ${relX2 - deltaX},${relY2} ${relX2},${relY2}`;

          const key = `${prereqId}->${skill.id}`;
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", pathData);
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "var(--color-border)");
          path.setAttribute("stroke-width", "2");
          frag.appendChild(path);

          this._linePathCache.set(key, {
            path,
            prereqId,
            skillId: skill.id,
            isHighlighted: false
          });

          if (!this._lineKeyBySkill.has(prereqId)) this._lineKeyBySkill.set(prereqId, new Set());
          if (!this._lineKeyBySkill.has(skill.id)) this._lineKeyBySkill.set(skill.id, new Set());
          this._lineKeyBySkill.get(prereqId).add(key);
          this._lineKeyBySkill.get(skill.id).add(key);
        }
      }

      svg.appendChild(frag);
      this._needsLineGeometryRebuild = false;
      rebuiltGeometry = true;
    }

    const keysToUpdate = new Set();
    const updateAll = rebuiltGeometry || !changedSkillIds || changedSkillIds.size === 0;
    if (updateAll) {
      for (const key of this._linePathCache.keys()) keysToUpdate.add(key);
    } else {
      for (const skillId of changedSkillIds) {
        const keys = this._lineKeyBySkill.get(skillId);
        if (!keys) continue;
        for (const key of keys) keysToUpdate.add(key);
      }
    }

    for (const key of keysToUpdate) {
      const line = this._linePathCache.get(key);
      if (!line) continue;
      const highlighted = this._selectedSkillIds.has(line.skillId) && this._selectedSkillIds.has(line.prereqId);
      if (highlighted === line.isHighlighted) continue;
      line.path.setAttribute("stroke", highlighted ? "var(--theme-color)" : "var(--color-border)");
      line.path.setAttribute("stroke-width", highlighted ? "3" : "2");
      line.isHighlighted = highlighted;
    }
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
    if (target.classList.contains("default-skill")) return;

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
    this._resolveOnce(null);
    return super.close(options);
  }

  _resolveOnce(value) {
    if (this._resolved) return;
    this._resolved = true;
    this._resolve?.(value);
  }
}
