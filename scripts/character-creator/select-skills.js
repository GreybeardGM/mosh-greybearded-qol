import { getThemeColor } from "../utils/get-theme-color.js";
import { loadAllItemsByType } from "../utils/item-loader.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class SkillSelectorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "character-creator-select-skills",
    tag: "form",
    window: {
      title: "Select Skills",
      contentClasses: ["greybeardqol", "skill-selection"],
      resizable: true
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
      template: "modules/mosh-greybearded-qol/templates/parts/confirm-button.html"
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

    const loadedSkills = await loadAllItemsByType("skill");
    const allSkills = loadedSkills.map(skill => {
      if (skill?.system?.rank) skill.system.rank = String(skill.system.rank).toLowerCase();
      return skill;
    });

    const skillMap = new Map(allSkills.map(s => [s.id, s]));
    const dependencies = getSkillDependencies(allSkills);
    const sortedSkills = allSkills;

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

    return { stripHtml, sortedSkills, skillMap, dependencies, granted, basePoints, orOptions };
  }

  constructor({ actor, selectedClass, resolve, stripHtml, sortedSkills, skillMap, dependencies, granted, basePoints, orOptions }, options = {}) {
    super(options);
    this.actor = actor;
    this.selectedClass = selectedClass;
    this._resolve = resolve;
    this._resolved = false;

    this.stripHtml = stripHtml;
    this.sortedSkills = sortedSkills;
    this.skillMap = skillMap;
    this.dependencies = dependencies;
    this.granted = granted;
    this.basePoints = basePoints;
    this.orOptions = orOptions;

    this.points = structuredClone(basePoints);
  }

  _getRoot() {
    if (this.element instanceof HTMLElement) return this.element;
    if (this.element?.[0] instanceof HTMLElement) return this.element[0];
    return null;
  }

  _selectedSkills() {
    const root = this._getRoot();
    if (!root) return new Set();
    return new Set(Array.from(root.querySelectorAll(".skill-card.selected")).map(el => el.dataset.skillId));
  }

  _drawLines() {
    const root = this._getRoot();
    if (!root) return;

    const svg = root.querySelector("#skill-arrows");
    if (!svg) return;
    svg.innerHTML = "";

    const selected = this._selectedSkills();
    const linesToDraw = [];
    const cardById = new Map(
      Array.from(root.querySelectorAll(".skill-card[data-skill-id]")).map(el => [el.dataset.skillId, el])
    );

    for (const skill of this.sortedSkills) {
      const prereqIds = (skill.system.prerequisite_ids || []).map(p => p.split(".").pop());
      for (const prereqId of prereqIds) {
        const fromEl = cardById.get(prereqId);
        const toEl = cardById.get(skill.id);
        if (!fromEl || !toEl) continue;

        const rect1 = fromEl.getBoundingClientRect();
        const rect2 = toEl.getBoundingClientRect();
        const parentRect = svg.getBoundingClientRect();

        const relX1 = rect1.left + rect1.width - parentRect.left;
        const relY1 = rect1.top + rect1.height / 2 - parentRect.top;
        const relX2 = rect2.left - parentRect.left;
        const relY2 = rect2.top + rect2.height / 2 - parentRect.top;

        const deltaX = Math.abs(relX2 - relX1) / 2;
        const pathData = `M ${relX1},${relY1} C ${relX1 + deltaX},${relY1} ${relX2 - deltaX},${relY2} ${relX2},${relY2}`;
        const isHighlighted = selected.has(skill.id) && selected.has(prereqId) && (skill.system.rank === "expert" || skill.system.rank === "master");

        linesToDraw.push({ d: pathData, highlight: isHighlighted });
      }
    }

    for (const line of linesToDraw.filter(l => !l.highlight)) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", line.d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "var(--color-border)");
      path.setAttribute("stroke-width", "2");
      svg.appendChild(path);
    }

    for (const line of linesToDraw.filter(l => l.highlight)) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", line.d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "var(--theme-color)");
      path.setAttribute("stroke-width", "3");
      svg.appendChild(path);
    }
  }

  _updateSkillAvailability() {
    const root = this._getRoot();
    if (!root) return;

    const selectedSkills = this._selectedSkills();

    root.querySelectorAll(".skill-card:not(.default-skill)").forEach(el => {
      const skillId = el.dataset.skillId;
      const rank = el.dataset.rank;
      const selected = el.classList.contains("selected");

      if (this.points[rank] === 0 && !selected) {
        el.classList.add("locked");
        return;
      }

      if (rank === "trained") {
        el.classList.remove("locked");
        return;
      }

      const skill = this.skillMap.get(skillId);
      const prereqs = (skill?.system?.prerequisite_ids || []).map(p => p.split(".").pop());
      const unlocked = prereqs.length === 0 || prereqs.some(id => selectedSkills.has(id));
      if (unlocked) {
        el.classList.remove("locked");
      } else {
        el.classList.add("locked");
        el.classList.remove("selected");
      }
    });
  }

  _updateUi() {
    const root = this._getRoot();
    if (!root) return;

    root.querySelectorAll(".point-count").forEach(el => {
      const rank = el.dataset.rank;
      el.textContent = String(this.points[rank]);
    });

    const remaining = Object.values(this.points).reduce((a, b) => a + b, 0);
    const hasOrOptions = this.orOptions.length > 0;
    const orSelected = !hasOrOptions || root.querySelector(".or-option.selected");
    const allowConfirm = remaining === 0 && !!orSelected;

    const confirm = root.querySelector("#confirm-button");
    if (confirm) {
      confirm.classList.toggle("locked", !allowConfirm);
      confirm.disabled = !allowConfirm;
    }

    this._updateSkillAvailability();
    this._drawLines();
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
    this._updateUi();

    const root = this._getRoot();
    if (!root) return;
    const wrapper = root.closest(".app");
    if (wrapper) {
      wrapper.style.width = "1200px";
      wrapper.style.maxWidth = "95vw";
      wrapper.style.margin = "0 auto";
    }
  }

  static _onToggleSkill(event, target) {
    if (target.classList.contains("default-skill") || target.classList.contains("locked")) return;

    const root = this._getRoot();
    if (!root) return;

    const rank = target.dataset.rank;
    if (target.classList.contains("selected")) {
      const skillId = target.dataset.skillId;
      const dependents = this.dependencies.get(skillId) || new Set();

      for (const depId of dependents) {
        const depEl = root.querySelector(`[data-skill-id='${depId}']`);
        if (!depEl?.classList.contains("selected")) continue;

        const depSkill = this.skillMap.get(depId);
        const depPrereqs = (depSkill.system.prerequisite_ids || []).map(p => p.split(".").pop());

        const fulfilled = depPrereqs.filter(pid => {
          if (pid === skillId) return false;
          const el = root.querySelector(`[data-skill-id='${pid}']`);
          return el?.classList.contains("selected");
        });

        if (fulfilled.length === 0) {
          ui.notifications.warn(`${depSkill.name} needs this skill to remain selected.`);
          return;
        }
      }

      target.classList.remove("selected");
      this.points[rank]++;
      this._updateUi();
      return;
    }

    if (this.points[rank] <= 0) return;
    target.classList.add("selected");
    this.points[rank]--;
    this._updateUi();
  }

  static _onSelectOrOption(event, target) {
    const root = this._getRoot();
    if (!root) return;

    root.querySelectorAll(".or-option").forEach(el => el.classList.remove("selected"));
    target.classList.add("selected");

    const opt = this.orOptions.find(o => o.id === target.dataset.option);
    this.points.trained = this.basePoints.trained + (opt?.trained || 0);
    this.points.expert = this.basePoints.expert + (opt?.expert || 0);
    this.points.master = this.basePoints.master + (opt?.master || 0);

    root.querySelectorAll(".skill-card.selected:not(.default-skill)").forEach(el => el.classList.remove("selected"));
    this._updateUi();
  }

  static async _onSubmit() {
    const root = this._getRoot();
    const confirm = root?.querySelector("#confirm-button");
    if (!root || !confirm || confirm.classList.contains("locked")) return;

    const selectedUUIDs = Array.from(root.querySelectorAll(".skill-card.selected[data-uuid]")).map(el => el.dataset.uuid);

    const selectedItems = await Promise.all(selectedUUIDs.map(async uuid => {
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
    this._resolveOnce(null);
    return super.close(options);
  }

  _resolveOnce(value) {
    if (this._resolved) return;
    this._resolved = true;
    this._resolve?.(value);
  }
}

export async function selectSkills(actor, selectedClass) {
  return SkillSelectorApp.wait({ actor, selectedClass });
}
