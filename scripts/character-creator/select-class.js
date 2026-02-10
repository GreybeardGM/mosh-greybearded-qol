import { getThemeColor } from "../utils/get-theme-color.js";
import { loadAllItemsByType } from "../utils/item-loader.js";
import { stripHtml, toSkillId, toSkillPointBundle } from "./utils.js";
import { applyAppWrapperLayout, getAppRoot, resolveAppOnce } from "./app-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function normalizeCaps(text) {
  const lowered = text.toLowerCase().trim();
  return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}


function resolveSkillsFromReferences(references, { skillByUuid, skillMap }) {
  const unique = new Map();

  for (const ref of references) {
    const rawRef = typeof ref === "string" ? ref : ref?.uuid || ref?.id;
    if (!rawRef) continue;

    const skill = skillByUuid.get(rawRef) || skillMap.get(toSkillId(rawRef));
    if (!skill) continue;

    unique.set(skill.id, {
      id: skill.id,
      uuid: skill.uuid,
      name: skill.name,
      img: skill.img || "icons/svg/d20-grey.svg"
    });
  }

  return [...unique.values()];
}

export class ClassSelectorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "character-creator-select-class",
    tag: "form",
    window: {
      title: "MoshQoL.CharacterCreator.SelectClass.Title",
      contentClasses: ["greybeardqol", "class-selection"],
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
      selectClass: this._onSelectClass,
      toggleSkillView: this._onToggleSkillView
    }
  };

  static PARTS = {
    form: {
      template: "modules/mosh-greybearded-qol/templates/character-creator/select-class.html"
    },
    confirm: {
      template: "modules/mosh-greybearded-qol/templates/ui/confirm-button.html"
    },
    viewToggle: {
      template: "modules/mosh-greybearded-qol/templates/character-creator/select-class-view-toggle.html"
    }
  };

  static async wait({ actor, applyStats = true }) {
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Errors.NoActorProvided"));
      return null;
    }

    const prepared = await this._prepareData();

    return new Promise(resolve => {
      const app = new this({ actor, applyStats, resolve, ...prepared });
      app.render(true);
    });
  }

  static async _prepareData() {
    const formatAttribute = (value, label) => {
      if (!Number.isFinite(value) || value === 0) return null;
      const prefix = value > 0 ? "+" : "";
      return `${prefix}${Math.abs(value) < 10 ? "\u00A0" : ""}${value}  ${label}`;
    };

    const stats = ["strength", "speed", "intellect", "combat"];
    const saves = ["sanity", "fear", "body"];

    const [sortedClasses, allSkills] = await Promise.all([
      loadAllItemsByType("class"),
      loadAllItemsByType("skill")
    ]);

    const skillMap = new Map(allSkills.map(s => [s.id, s]));
    const skillByUuid = new Map(allSkills.map(s => [s.uuid, s]));

    const classes = sortedClasses.map(cls => {
      const description = stripHtml(cls.system.description || game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.NoDescription"));
      const trauma = normalizeCaps(stripHtml(cls.system.trauma_response || game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.NoTraumaSpecified")));
      const base = cls.system.base_adjustment || {};
      const selected = cls.system.selected_adjustment || {};
      const attr = [];

      for (const group of [stats, saves]) {
        const values = group.map(stat => base[stat] || 0);
        const allEqual = values.every(v => v === values[0]);
        if (allEqual && values[0] !== 0) {
          attr.push(formatAttribute(values[0], group === stats ? game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.AllStats") : game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.AllSaves")));
        } else {
          for (const stat of group) {
            const value = base[stat] || 0;
            const formatted = formatAttribute(value, stat.charAt(0).toUpperCase() + stat.slice(1));
            if (formatted) attr.push(formatted);
          }
        }
      }

      const wounds = (base.max_wounds || 0) + (selected.max_wounds || 0);
      if (wounds) attr.push(formatAttribute(wounds, game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.Wounds")));

      if (Array.isArray(selected.choose_stat)) {
        for (const choice of selected.choose_stat) {
          const isAllStats = stats.every(stat => choice.stats.includes(stat));
          const isAllSaves = saves.every(save => choice.stats.includes(save));
          const label = isAllStats
            ? game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.AnyStat")
            : isAllSaves
              ? game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.AnySave")
              : choice.stats.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ");
          const mod = parseInt(choice.modification, 10) || 0;
          attr.push(formatAttribute(mod, game.i18n.format("MoshQoL.CharacterCreator.SelectClass.ChooseOne", { label })));
        }
      }

      const baseAnd = selected.choose_skill_and || {};

      const defaultSkills = {
        id: `${cls.id}-default`,
        name: game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.DefaultSkills"),
        ...toSkillPointBundle(baseAnd),
        skills: resolveSkillsFromReferences(cls.system.base_adjustment?.skills_granted ?? [], { skillByUuid, skillMap })
      };

      const orOptions = (selected.choose_skill_or || []).flat().map((option, index) => ({
        id: `${cls.id}-or-${index}`,
        name: option.name || game.i18n.format("MoshQoL.CharacterCreator.SelectClass.OrOption", { index: index + 1 }),
        ...toSkillPointBundle(option),
        skills: resolveSkillsFromReferences(option.from_list || [], { skillByUuid, skillMap })
      }));

      return {
        id: cls.id,
        uuid: cls.uuid,
        name: cls.name,
        img: cls.img || "icons/svg/mystery-man.svg",
        trauma,
        description,
        attributes: attr.join("<br>") || game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.NoAttributes"),
        skillView: {
          defaultSkills,
          orOptions
        }
      };
    });

    const classCount = sortedClasses.length;
    let gridColumns = 5;
    if ([3, 6].includes(classCount)) gridColumns = 3;
    else if ([4, 7, 8, 11, 12].includes(classCount)) gridColumns = 4;

    return { classes, gridColumns };
  }

  constructor({ actor, applyStats, resolve, classes, gridColumns }, options = {}) {
    super(options);
    this.actor = actor;
    this.applyStats = applyStats;
    this._resolve = resolve;
    this._resolved = false;

    this.classes = classes;
    this.gridColumns = gridColumns;
    this.themeColor = getThemeColor();
    this._selectedClassId = null;
    this._showSkillView = false;
  }

  _getRoot() {
    return getAppRoot(this.element);
  }

  _updateSelectionUi() {
    const root = this._getRoot();
    if (!root) return;

    root.querySelectorAll(".class-card").forEach(card => {
      const selected = card.dataset.classId === this._selectedClassId;
      card.classList.toggle("selected", selected);
    });

    const confirm = root.querySelector("#confirm-button");
    if (!confirm) return;

    const locked = !this._selectedClassId;
    confirm.classList.toggle("locked", locked);
    confirm.disabled = locked;
  }

  async _prepareContext() {
    return {
      themeColor: this.themeColor,
      gridColumns: this.gridColumns,
      classes: this.classes,
      showSkillView: this._showSkillView,
      confirmLocked: !this._selectedClassId
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const root = this._getRoot();
    if (!root) return;

    applyAppWrapperLayout(root, { width: "auto" });

    this._updateSelectionUi();
  }

  static _onSelectClass(event, target) {
    const classId = target.dataset.classId;
    if (!classId || classId === this._selectedClassId) return;
    this._selectedClassId = classId;
    this._updateSelectionUi();
  }

  static _onToggleSkillView() {
    this._showSkillView = !this._showSkillView;
    this.render();
  }

  static async _onSubmit() {
    const selected = this.classes.find(c => c.id === this._selectedClassId);
    if (!selected) return;

    const classItem = await fromUuid(selected.uuid);
    if (!classItem) return ui.notifications.error(game.i18n.localize("MoshQoL.CharacterCreator.SelectClass.FailedToLoadClassData"));

    const updates = {
      "system.class.value": classItem.name,
      "system.class.uuid": classItem.uuid,
      "system.other.stressdesc.value": classItem.system.trauma_response
        ? normalizeCaps(classItem.system.trauma_response)
        : ""
    };

    if (this.applyStats) {
      const base = classItem.system.base_adjustment || {};
      const allStats = ["strength", "speed", "intellect", "combat", "sanity", "fear", "body"];
      for (const stat of allStats) {
        const val = parseInt(base[stat], 10);
        if (!isNaN(val) && val !== 0) {
          updates[`system.stats.${stat}.value`] = (foundry.utils.getProperty(this.actor.system, `stats.${stat}.value`) || 0) + val;
        }
      }
      if (!isNaN(base.max_wounds)) {
        updates["system.hits.max"] = (foundry.utils.getProperty(this.actor.system, "hits.max") || 2) + base.max_wounds;
        updates["system.hits.value"] = 0;
      }
    }

    await this.actor.update(updates);
    resolveAppOnce(this, classItem);
  }

  async close(options = {}) {
    resolveAppOnce(this, null);
    return super.close(options);
  }

}
