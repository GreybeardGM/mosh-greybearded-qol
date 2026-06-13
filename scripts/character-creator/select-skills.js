import { MODULE_ID, templatePath } from "../codex/constants.js";
import { loadAllItemsByType } from "../utils/item-loader.js";
import { normalizeText, stripHtml, toEmbeddedItemData, toSkillId, toSkillSelectionPointBundle } from "./utils.js";
import { applyAppWrapperLayout, getAppRoot, resolveAppOnce } from "../utils/application-helpers.js";
import { appendQolThemeContext, createQolAppDefaultOptions } from "../utils/application-options.js";
import { resolveSkillReferences } from "./skill-reference-utils.js";
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
  return resolveSkillReferences(option?.from_list, {
    skillByUuid,
    skillMap,
    includeRank: true,
    onMissing: rawRef => console.warn(`[${MODULE_ID}] Could not resolve linked OR skill reference "${rawRef}" on option "${optionName}".`)
  });
}

function getSkillDependencies(skills) {
  const map = new Map();
  for (const skill of skills) {
    for (const prereqId of skill.prereqIds ?? []) {
      let dependents = map.get(prereqId);
      if (!dependents) {
        dependents = new Set();
        map.set(prereqId, dependents);
      }
      dependents.add(skill.id);
    }
  }
  return map;
}

function toSkillViewModel(skill) {
  return {
    id: skill.id,
    _id: skill.id,
    uuid: skill.uuid,
    name: skill.name,
    nameLower: normalizeText(skill.name),
    img: skill.img,
    system: skill.system,
    rank: normalizeText(skill?.system?.rank),
    prereqIds: (skill.system?.prerequisite_ids ?? []).map(toSkillId)
  };
}

export class SkillSelectorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createQolAppDefaultOptions({
    id: "character-creator-select-skills",
    title: "MoshQoL.CharacterCreator.SelectSkills.Title",
    windowClasses: "qol-skill-selection",
    position: { width: 1200 },
    form: { handler: this._onSubmit },
    actions: {
      toggleSkill: this._onToggleSkill,
      selectOrOption: this._onSelectOrOption
    }
  });

  static PARTS = {
    options: {
      template: templatePath("character-creator/select-skills-options.html")
    },
    skilltree: {
      template: templatePath("character-creator/skilltree-core.html")
    },
    confirm: {
      template: templatePath("ui/confirm-button.html")
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
    const allSkills = await loadAllItemsByType("skill");
    const sortedSkills = allSkills.map(toSkillViewModel);

    const skillMap = new Map(sortedSkills.map(s => [s.id, s]));
    const skillByUuid = new Map(allSkills.map(s => [s.uuid, s]));
    const dependencies = getSkillDependencies(sortedSkills);

    const baseAnd = selectedClass.system.selected_adjustment?.choose_skill_and ?? {};
    const baseOr = selectedClass.system.selected_adjustment?.choose_skill_or ?? [];
    const granted = new Set((selectedClass.system.base_adjustment?.skills_granted ?? []).map(toSkillId));

    const basePoints = toSkillSelectionPointBundle(baseAnd);

    const orOptions = baseOr.flat().map((opt, i) => {
      const name = opt.name ?? `Option ${i + 1}`;
      return {
        id: `or-${i}`,
        name,
        ...toSkillSelectionPointBundle(opt),
        skills: resolveOrOptionSkills(opt, { skillByUuid, skillMap, optionName: name })
      };
    });

    const prereqIdsBySkillId = new Map(sortedSkills.map(skill => [skill.id, skill.prereqIds]));

    return { stripHtml, sortedSkills, skillMap, skillByUuid, dependencies, prereqIdsBySkillId, granted, basePoints, orOptions };
  }

  constructor({ actor, selectedClass, resolve, stripHtml, sortedSkills, skillMap, skillByUuid, dependencies, prereqIdsBySkillId, granted, basePoints, orOptions }, options = {}) {
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
    this.prereqIdsBySkillId = prereqIdsBySkillId;
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
    this._dom = cacheSkillTreeDom(root);
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

  _getPrereqIds(skillId) {
    return this.prereqIdsBySkillId.get(skillId) ?? [];
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
        const el = this._dom?.skillCardById.get(skillId);
        if (el) cards.add(el);
      }
      for (const rank of hasAffectedRanks ? affectedRanks : []) {
        for (const el of this._dom?.skillCardsByRank.get(rank) ?? []) cards.add(el);
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

      const prereqs = this._getPrereqIds(skillId);
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
    return appendQolThemeContext({
      actor: this.actor,
      selectedClass: this.selectedClass,
      sortedSkills: this.sortedSkills,
      defaultSkillMode: "id",
      defaultSkillValues: [...this.granted],
      showPointCounters: true,
      basePoints: this.basePoints,
      orOptions: this.orOptions,
      confirmLocked: true
    });
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
      for (const depId of dependents) {
        if (!this._isSkillSelected(depId)) continue;

        const depPrereqs = this._getPrereqIds(depId);
        const hasAlternatePrereq = depPrereqs.some(pid => pid !== skillId && this._isSkillSelected(pid));
        if (hasAlternatePrereq) continue;

        const depSkill = this.skillMap.get(depId);
        ui.notifications.warn(game.i18n.format("MoshQoL.CharacterCreator.SelectSkills.DependencyNeedsSkill", { skillName: depSkill.name }));
        return;
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
      if (typeof preloaded?.toObject === "function") {
        return toEmbeddedItemData(preloaded);
      }

      const item = await fromUuid(uuid);
      if (!item || item.type !== "skill") {
        console.warn("Invalid or missing skill:", uuid);
        return null;
      }
      return toEmbeddedItemData(item);
    }));

    const validItems = selectedItems.filter(Boolean);
    if (validItems.length > 0) {
      await this.actor.createEmbeddedDocuments("Item", validItems);
    }

    resolveAppOnce(this, validItems.length > 0 ? validItems : null);
  }

  async close(options = {}) {
    cleanupSkillTreeApp(this, { clearCollections: ["_prevSelectedSkills", "_orOptionById", "_currentOrLockedSkillIds", "prereqIdsBySkillId"] });
    resolveAppOnce(this, null);
    return super.close(options);
  }

}
