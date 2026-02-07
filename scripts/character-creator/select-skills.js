import { getThemeColor } from "../utils/get-theme-color.js";
import { loadAllItemsByType } from "../utils/item-loader.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SkillSelectorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "character-creator-select-skills",
    tag: "form",
    window: {
      title: "Select Skills",
      contentClasses: ["greybeardqol", "skill-selection"],
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
      toggleSkill: this._onToggleSkill,
      selectOrOption: this._onSelectOrOption
    }
  };

  static PARTS = {
    options: {
      template: "modules/mosh-greybearded-qol/templates/character-creator/select-skills-options.html"
    },
    skilltree: {
      template: "modules/mosh-greybearded-qol/templates/character-creator/select-skills-skilltree.html"
    },
    confirm: {
      template: "modules/mosh-greybearded-qol/templates/ui/confirm-button.html"
    }
  };

  static async wait({ actor, selectedClass }) {
    const prep = await this._prepareData({ actor, selectedClass });
    return new Promise(resolve => {
      const app = new this({ actor, selectedClass, resolve, ...prep });
      app.render(true);
    });
  }

  static async _prepareData({ actor, selectedClass }) {
    const stripHtml = html => String(html ?? "").replace(/<[^>]*>/g, "").trim();
    const getSkillDependencies = skills => {
      const map = new Map();
      for (const skill of skills) {
        for (const prereq of skill.system.prerequisite_ids || []) {
          const prereqId = prereq.split(".").pop();
          if (!map.has(prereqId)) map.set(prereqId, new Set());
          map.get(prereqId).add(skill.id);
        }
      }
      return map;
    };

    const allSkills = await loadAllItemsByType("skill");

    const skillMap = new Map(allSkills.map(s => [s.id, s]));
    const skillByUuid = new Map(allSkills.map(s => [s.uuid, s]));
    const dependencies = getSkillDependencies(allSkills);
    const sortedSkills = allSkills.map(skill => ({
      id: skill.id,
      _id: skill.id,
      uuid: skill.uuid,
      name: skill.name,
      img: skill.img,
      system: skill.system,
      rank: String(skill?.system?.rank ?? "").toLowerCase()
    }));

    const baseAnd = selectedClass.system.selected_adjustment?.choose_skill_and ?? {};
    const baseOr = selectedClass.system.selected_adjustment?.choose_skill_or ?? [];
    const granted = new Set((selectedClass.system.base_adjustment?.skills_granted ?? []).map(uuid => uuid.split(".").pop()));

    const fullSetExpert = baseAnd.expert_full_set || 0;
    const fullSetMaster = baseAnd.master_full_set || 0;

    const basePoints = {
      trained: (baseAnd.trained || 0) + fullSetExpert + fullSetMaster,
      expert: (baseAnd.expert || 0) + fullSetExpert + fullSetMaster,
      master: (baseAnd.master || 0) + fullSetMaster
    };

    const toNum = v => {
      if (v === "" || v === null || v === undefined) return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const add = (...vals) => vals.map(toNum).reduce((a, b) => a + b, 0);

    const orOptions = baseOr.flat().map((opt, i) => ({
      id: `or-${i}`,
      name: opt.name ?? `Option ${i + 1}`,
      trained: add(opt.trained, opt.expert_full_set, opt.master_full_set),
      expert: add(opt.expert, opt.expert_full_set, opt.master_full_set),
      master: add(opt.master, opt.master_full_set)
    }));

    return { stripHtml, sortedSkills, skillMap, skillByUuid, dependencies, granted, basePoints, orOptions };
  }

  constructor({ actor, selectedClass, resolve, stripHtml, sortedSkills, skillMap, skillByUuid, dependencies, granted, basePoints, orOptions }, options = {}) {
    super(options);
    this.actor = actor;
    this.selectedClass = selectedClass;
    this._resolve = resolve;
    this._resolved = false;

    this.stripHtml = stripHtml;
    this.sortedSkills = sortedSkills;
    this.skillMap = skillMap;
    this.skillByUuid = skillByUuid;
    this.dependencies = dependencies;
    this.granted = granted;
    this.basePoints = basePoints;
    this.orOptions = orOptions;

    this.points = structuredClone(basePoints);
    this._lineDrawFrame = null;
    this._dom = null;
    this._linePathCache = new Map();
    this._lineKeyBySkill = new Map();
    this._needsLineGeometryRebuild = true;
    this._prevSelectedSkills = new Set();
    this._pendingChangedSkillIds = null;
    this._selectedSkillIds = new Set();
  }

  _getRoot() {
    if (this.element instanceof HTMLElement) return this.element;
    if (this.element?.[0] instanceof HTMLElement) return this.element[0];
    return null;
  }

  _cacheDomReferences(root) {
    const skillCards = Array.from(root.querySelectorAll(".skill-card"));
    const skillCardById = new Map(skillCards.map(el => [el.dataset.skillId, el]));
    const skillCardsByRank = new Map();
    for (const el of skillCards) {
      const rank = el.dataset.rank;
      if (!skillCardsByRank.has(rank)) skillCardsByRank.set(rank, []);
      skillCardsByRank.get(rank).push(el);
    }

    this._dom = {
      root,
      svg: root.querySelector("#skill-arrows"),
      confirm: root.querySelector("#confirm-button"),
      orOptions: Array.from(root.querySelectorAll(".or-option")),
      pointCounts: Array.from(root.querySelectorAll(".point-count")),
      skillCards,
      skillCardById,
      skillCardsByRank
    };
  }

  _initializeSelectionStateFromDom() {
    if (this._selectedSkillIds.size > 0) return;
    const cards = this._dom?.skillCards ?? [];
    this._selectedSkillIds = new Set(cards.filter(el => el.classList.contains("selected")).map(el => el.dataset.skillId));
  }

  _collectAvailabilityAffectedSkillIds(seedSkillIds) {
    if (!seedSkillIds?.size) return null;

    const affected = new Set(seedSkillIds);
    const queue = [...seedSkillIds];
    while (queue.length) {
      const skillId = queue.shift();
      const dependents = this.dependencies.get(skillId);
      if (!dependents) continue;
      for (const dependentId of dependents) {
        if (affected.has(dependentId)) continue;
        affected.add(dependentId);
        queue.push(dependentId);
      }
    }

    return affected;
  }

  _selectedSkills() {
    if (this._selectedSkillIds instanceof Set) return new Set(this._selectedSkillIds);
    const cards = this._dom?.skillCards ?? [];
    return new Set(cards.filter(el => el.classList.contains("selected")).map(el => el.dataset.skillId));
  }

  _isSkillSelected(skillId) {
    return this._selectedSkillIds.has(skillId);
  }

  _getPrereqIds(skill) {
    return (skill?.system?.prerequisite_ids || []).map(prereq => prereq.split(".").pop());
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
    const root = this._getRoot();
    if (root) this._cacheDomReferences(root);

    const cachedRoot = this._dom?.root;
    const svg = this._dom?.svg;
    if (!cachedRoot || !svg) return;

    const selected = this._selectedSkillIds;

    let rebuiltGeometry = false;
    if (this._needsLineGeometryRebuild || this._linePathCache.size === 0) {
      this._linePathCache.clear();
      this._lineKeyBySkill.clear();
      svg.innerHTML = "";

      // Reuse the centralized DOM cache to keep draw geometry in sync with one source of truth.
      const parentRect = svg.getBoundingClientRect();
      const frag = document.createDocumentFragment();

      for (const skill of this.sortedSkills) {
        const prereqIds = (skill.system.prerequisite_ids || []).map(p => p.split(".").pop());
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
            highlightable: skill.system.rank === "expert" || skill.system.rank === "master",
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
      const highlighted = line.highlightable && selected.has(line.skillId) && selected.has(line.prereqId);
      if (line.isHighlighted === highlighted) continue;

      line.path.setAttribute("stroke", highlighted ? "var(--theme-color)" : "var(--color-border)");
      line.path.setAttribute("stroke-width", highlighted ? "3" : "2");
      line.isHighlighted = highlighted;
    }
  }

  _updateSkillAvailability(selectedSkillIds, { affectedSkillIds = null, affectedRanks = null } = {}) {
    const removedSelections = new Set();

    const hasAffectedSkillIds = affectedSkillIds instanceof Set && affectedSkillIds.size > 0;
    const hasAffectedRanks = affectedRanks instanceof Set && affectedRanks.size > 0;

    const cards = new Set();
    if (!hasAffectedSkillIds && !hasAffectedRanks) {
      for (const el of this._dom?.skillCards ?? []) cards.add(el);
    } else {
      for (const skillId of hasAffectedSkillIds ? affectedSkillIds : []) {
        const el = this._dom?.skillCardById?.get(skillId);
        if (el) cards.add(el);
      }
      for (const rank of hasAffectedRanks ? affectedRanks : []) {
        for (const el of this._dom?.skillCardsByRank?.get(rank) ?? []) cards.add(el);
      }
    }

    for (const el of cards) {
      if (el.classList.contains("default-skill")) continue;

      const skillId = el.dataset.skillId;
      const rank = el.dataset.rank;
      const selected = selectedSkillIds.has(skillId);

      if (this.points[rank] === 0 && !selected) {
        el.classList.add("locked");
        continue;
      }

      if (rank === "trained") {
        el.classList.remove("locked");
        continue;
      }

      const skill = this.skillMap.get(skillId);
      const prereqs = (skill?.system?.prerequisite_ids || []).map(p => p.split(".").pop());
      const unlocked = prereqs.length === 0 || prereqs.some(id => selectedSkillIds.has(id));
      if (unlocked) {
        el.classList.remove("locked");
      } else {
        el.classList.add("locked");
        if (selected) {
          el.classList.remove("selected");
          removedSelections.add(skillId);
          selectedSkillIds.delete(skillId);
        }
      }
    }

    return removedSelections;
  }

  _updateUi({ changedSkillIds = null, changedRanks = null, forceFullAvailability = false } = {}) {
    if (!this._dom) return;

    this._dom.pointCounts.forEach(el => {
      const rank = el.dataset.rank;
      el.textContent = String(this.points[rank]);
    });

    const remaining = Object.values(this.points).reduce((a, b) => a + b, 0);
    const hasOrOptions = this.orOptions.length > 0;
    const orSelected = !hasOrOptions || this._dom.orOptions.some(el => el.classList.contains("selected"));
    const allowConfirm = remaining === 0 && orSelected;

    if (this._dom.confirm) {
      this._dom.confirm.classList.toggle("locked", !allowConfirm);
      this._dom.confirm.disabled = !allowConfirm;
    }

    const selectedBeforeAvailability = this._selectedSkillIds;
    const affectedSkillIds = forceFullAvailability
      ? null
      : this._collectAvailabilityAffectedSkillIds(new Set(changedSkillIds ?? []));
    const removedByAvailability = this._updateSkillAvailability(selectedBeforeAvailability, {
      affectedSkillIds,
      affectedRanks: forceFullAvailability ? null : new Set(changedRanks ?? [])
    });
    const selectedAfterAvailability = new Set(selectedBeforeAvailability);

    const changed = new Set(changedSkillIds ?? []);
    for (const skillId of removedByAvailability) changed.add(skillId);

    for (const skillId of selectedAfterAvailability) {
      if (!this._prevSelectedSkills.has(skillId)) changed.add(skillId);
    }
    for (const skillId of this._prevSelectedSkills) {
      if (!selectedAfterAvailability.has(skillId)) changed.add(skillId);
    }

    this._scheduleDrawLines({ changedSkillIds: changed });
    this._prevSelectedSkills = selectedAfterAvailability;
  }

  async _prepareContext() {
    return {
      themeColor: getThemeColor(),
      actor: this.actor,
      selectedClass: this.selectedClass,
      sortedSkills: this.sortedSkills,
      granted: [...this.granted],
      basePoints: this.basePoints,
      orOptions: this.orOptions,
      confirmLocked: true
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const root = this._getRoot();
    if (!root) return;

    const wrapper = root.closest(".app");
    if (wrapper) {
      wrapper.style.width = "1200px";
      wrapper.style.maxWidth = "95vw";
      wrapper.style.margin = "0 auto";
    }

    this._cacheDomReferences(root);
    this._initializeSelectionStateFromDom();

    root.querySelectorAll(".skill-card img").forEach(img => {
      if (img.complete) return;
      img.addEventListener("load", () => this._scheduleDrawLines({ rebuild: true }), { once: true });
    });

    this._updateUi();
    this._scheduleDrawLines({ rebuild: true });
  }

  static _onToggleSkill(event, target) {
    if (target.classList.contains("default-skill") || target.classList.contains("locked")) return;

    if (!this._dom) return;

    const rank = target.dataset.rank;
    if (target.classList.contains("selected")) {
      const skillId = target.dataset.skillId;
      const dependents = this.dependencies.get(skillId) || new Set();
      const selectedDependents = [...dependents].filter(depId => {
        const depEl = this._dom.skillCardById.get(depId);
        return depEl?.classList.contains("selected");
      });

      for (const depId of selectedDependents) {
        const depSkill = this.skillMap.get(depId);
        const depPrereqs = this._getPrereqIds(depSkill);
        const fulfilled = depPrereqs.filter(pid => pid !== skillId && this._isSkillSelected(pid));

        if (fulfilled.length === 0) {
          ui.notifications.warn(`${depSkill.name} needs this skill to remain selected.`);
          return;
        }
      }

      target.classList.remove("selected");
      this._selectedSkillIds.delete(skillId);
      this.points[rank]++;
      this._updateUi({ changedSkillIds: new Set([skillId]), changedRanks: new Set([rank]) });
      return;
    }

    if (this.points[rank] <= 0) return;
    const skillId = target.dataset.skillId;
    target.classList.add("selected");
    this._selectedSkillIds.add(skillId);
    this.points[rank]--;
    this._updateUi({ changedSkillIds: new Set([skillId]), changedRanks: new Set([rank]) });
  }

  static _onSelectOrOption(event, target) {
    if (!this._dom) return;
    if (target.classList.contains("selected")) return;

    const changedSkillIds = new Set();

    const activeOrOption = this._dom.orOptions.find(el => el.classList.contains("selected"));
    if (activeOrOption) activeOrOption.classList.remove("selected");
    target.classList.add("selected");

    const opt = this.orOptions.find(o => o.id === target.dataset.option);
    this.points.trained = this.basePoints.trained + (opt?.trained || 0);
    this.points.expert = this.basePoints.expert + (opt?.expert || 0);
    this.points.master = this.basePoints.master + (opt?.master || 0);

    this._dom.skillCards.forEach(el => {
      if (el.classList.contains("selected") && !el.classList.contains("default-skill")) {
        el.classList.remove("selected");
        const skillId = el.dataset.skillId;
        this._selectedSkillIds.delete(skillId);
        changedSkillIds.add(skillId);
      }
    });

    this._updateUi({ changedSkillIds, forceFullAvailability: true });
  }

  static async _onSubmit() {
    const confirm = this._dom?.confirm;
    if (!confirm || confirm.classList.contains("locked")) return;

    const selectedUUIDs = this._dom.skillCards
      .filter(el => el.classList.contains("selected") && el.dataset.uuid)
      .map(el => el.dataset.uuid);

    const selectedItems = await Promise.all(selectedUUIDs.map(async uuid => {
      const preloaded = this.skillByUuid.get(uuid);
      if (preloaded) {
        const data = preloaded.toObject();
        delete data._id;
        return data;
      }

      const item = await fromUuid(uuid);
      if (!item || item.type !== "skill") {
        console.warn("Invalid or missing skill:", uuid);
        return null;
      }
      const itemData = item.toObject();
      delete itemData._id;
      return itemData;
    }));

    const validItems = selectedItems.filter(Boolean);
    if (validItems.length > 0) {
      await this.actor.createEmbeddedDocuments("Item", validItems);
    }

    this._resolveOnce(validItems.length > 0 ? validItems : null);
  }

  async close(options = {}) {
    if (this._lineDrawFrame) {
      cancelAnimationFrame(this._lineDrawFrame);
      this._lineDrawFrame = null;
    }
    this._dom = null;
    this._linePathCache.clear();
    this._lineKeyBySkill.clear();
    this._prevSelectedSkills.clear();
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
