import { getThemeColor } from "../utils/get-theme-color.js";
import { loadAllItemsByType } from "../utils/item-loader.js";
import { normalizeText, stripHtml, toSkillId, toSkillPointBundle, sumSkillPointFields } from "./utils.js";
import { applyAppWrapperLayout, getAppRoot, resolveAppOnce } from "./app-helpers.js";
import {
  cacheSkillTreeDom,
  cleanupSkillTreeApp,
  drawSkillLines,
  scheduleInitialSkillTreeDraw,
  scheduleSkillLineDraw,
  selectedSkillIdsFromDom
} from "./skill-selector-shared.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function resolveOrOptionSkills(option, { skillByUuid, skillMap, optionName = game.i18n.localize("MoshQoL.CharacterCreator.SelectSkills.UnknownOrOption") }) {
  const candidates = Array.isArray(option?.from_list) ? option.from_list : [];
  const unique = new Map();

  for (const entry of candidates) {
    const rawRef = typeof entry === "string" ? entry : entry?.uuid || entry?.id;
    if (!rawRef) continue;

    const byUuid = skillByUuid.get(rawRef);
    const skill = byUuid || skillMap.get(toSkillId(rawRef));

    if (!skill) {
      console.debug(`[mosh-greybearded-qol] Could not resolve linked OR skill reference "${rawRef}" on option "${optionName}".`);
      continue;
    }

    unique.set(skill.id, {
      id: skill.id,
      uuid: skill.uuid,
      name: skill.name,
      img: skill.img || "icons/svg/d20-grey.svg",
      rank: normalizeText(skill?.system?.rank)
    });
  }

  return [...unique.values()];
}

export class SkillSelectorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "character-creator-select-skills",
    tag: "form",
    window: {
      title: "MoshQoL.CharacterCreator.SelectSkills.Title",
      contentClasses: ["greybeardqol", "qol-skill-selection"],
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
      template: "modules/mosh-greybearded-qol/templates/character-creator/skilltree-core.html"
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
    const getSkillDependencies = skills => {
      const map = new Map();
      for (const skill of skills) {
        for (const prereq of skill.system.prerequisite_ids || []) {
          const prereqId = toSkillId(prereq);
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
      nameLower: normalizeText(skill.name),
      img: skill.img,
      system: skill.system,
      rank: normalizeText(skill?.system?.rank)
    }));

    const baseAnd = selectedClass.system.selected_adjustment?.choose_skill_and ?? {};
    const baseOr = selectedClass.system.selected_adjustment?.choose_skill_or ?? [];
    const granted = new Set((selectedClass.system.base_adjustment?.skills_granted ?? []).map(toSkillId));

    const basePoints = toSkillPointBundle(baseAnd);

    const orOptions = baseOr.flat().map((opt, i) => {
      const name = opt.name ?? `Option ${i + 1}`;
      return {
        id: `or-${i}`,
        name,
        trained: sumSkillPointFields(opt.trained, opt.expert_full_set, opt.master_full_set),
        expert: sumSkillPointFields(opt.expert, opt.expert_full_set, opt.master_full_set),
        master: sumSkillPointFields(opt.master, opt.master_full_set),
        skills: resolveOrOptionSkills(opt, { skillByUuid, skillMap, optionName: name })
      };
    });

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
    this._prevSelectedSkills = new Set();
    this._pendingChangedSkillIds = null;
    this._selectedSkillIds = new Set();
    this._orOptionById = new Map(orOptions.map(option => [option.id, option]));
    this._currentOrLockedSkillIds = new Set();
  }

  _getRoot() {
    return getAppRoot(this.element);
  }

  _cacheDomReferences(root) {
    this._dom = cacheSkillTreeDom(root, { includeOrOptions: true, includePointCounts: true });
  }

  _initializeSelectionStateFromDom() {
    if (this._selectedSkillIds.size > 0) return;
    const cards = this._dom?.skillCards ?? [];
    this._selectedSkillIds = selectedSkillIdsFromDom(cards);
  }

  _collectAvailabilityAffectedSkillIds(seedSkillIds) {
    if (!seedSkillIds?.size) return null;

    const affected = new Set(seedSkillIds);
    const queue = [...seedSkillIds];
    let queueIndex = 0;
    while (queueIndex < queue.length) {
      const skillId = queue[queueIndex++];
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
    return new Set(this._selectedSkillIds);
  }

  _isSkillSelected(skillId) {
    return this._selectedSkillIds.has(skillId);
  }

  _getPrereqIds(skill) {
    return (skill?.system?.prerequisite_ids || []).map(toSkillId);
  }

  _scheduleDrawLines({ changedSkillIds = null } = {}) {
    scheduleSkillLineDraw(this, { changedSkillIds });
  }

  _drawLines(changedSkillIds = null) {
    const selected = this._selectedSkillIds;

    drawSkillLines(this, changedSkillIds, {
      buildLineMeta: skill => ({
        highlightable: skill.rank === "expert" || skill.rank === "master"
      }),
      isHighlighted: line => line.highlightable && selected.has(line.skillId) && selected.has(line.prereqId)
    });
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
      if (el.classList.contains("default-skill") || el.classList.contains("or-locked-skill")) continue;

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
      const prereqs = (skill?.system?.prerequisite_ids || []).map(toSkillId);
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
      defaultSkillMode: "id",
      defaultSkillValues: [...this.granted],
      showPointCounters: true,
      basePoints: this.basePoints,
      orOptions: this.orOptions,
      confirmLocked: true
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const root = this._getRoot();
    if (!root) return;

    applyAppWrapperLayout(root, { width: "1200px" });

    this._cacheDomReferences(root);
    this._initializeSelectionStateFromDom();

    this._updateUi();
    scheduleInitialSkillTreeDraw(this);
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
          ui.notifications.warn(game.i18n.format("MoshQoL.CharacterCreator.SelectSkills.DependencyNeedsSkill", { skillName: depSkill.name }));
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

    const opt = this._orOptionById.get(target.dataset.option);
    this.points.trained = this.basePoints.trained + (opt?.trained || 0);
    this.points.expert = this.basePoints.expert + (opt?.expert || 0);
    this.points.master = this.basePoints.master + (opt?.master || 0);

    for (const skillId of [...this._selectedSkillIds]) {
      const el = this._dom.skillCardById.get(skillId);
      if (!el || el.classList.contains("default-skill")) continue;

      el.classList.remove("selected");
      if (this._currentOrLockedSkillIds.has(skillId)) {
        el.classList.remove("or-locked-skill", "locked");
      }

      this._selectedSkillIds.delete(skillId);
      changedSkillIds.add(skillId);
    }

    this._currentOrLockedSkillIds.clear();
    for (const skill of opt?.skills || []) {
      const el = this._dom.skillCardById.get(skill.id);
      if (!el) continue;
      el.classList.add("selected", "locked", "or-locked-skill");
      this._selectedSkillIds.add(skill.id);
      this._currentOrLockedSkillIds.add(skill.id);
      changedSkillIds.add(skill.id);
    }

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

    resolveAppOnce(this, validItems.length > 0 ? validItems : null);
  }

  async close(options = {}) {
    cleanupSkillTreeApp(this, { clearCollections: ["_prevSelectedSkills", "_orOptionById", "_currentOrLockedSkillIds"] });
    resolveAppOnce(this, null);
    return super.close(options);
  }

}
