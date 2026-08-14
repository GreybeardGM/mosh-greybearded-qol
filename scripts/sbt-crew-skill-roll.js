import { FLAG_CREW_ROSTER, MODULE_ID, templatePath } from "./codex/constants.js";
import { MOSH_FALLBACK_ACTOR_IMAGE } from "./codex/mosh-system.js";
import { getAppRoot, resolveAppOnce } from "./utils/application-helpers.js";
import { appendQolThemeContext, createQolAppDefaultOptions } from "./utils/application-options.js";
import { escapeHTML } from "./utils/html-safety.js";
import { getThemeColor } from "./utils/get-theme-color.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SBT_TEMPLATE = "systems/mosh/templates/actor/ship-sheet-sbt.html";
const SUPPORTED_STATS = new Set(["thrusters", "battle", "systems"]);
const MANUAL_SKILLS = [
  { rank: "Trained", bonus: 10 },
  { rank: "Expert", bonus: 15 },
  { rank: "Master", bonus: 20 }
];
const ROLL_MODES = Object.freeze({
  advantage: {
    label: "Mosh.Advantage",
    icon: "fas fa-angle-double-up",
    rollString: "1d100 [+]"
  },
  normal: {
    label: "Mosh.Normal",
    icon: "fas fa-minus",
    rollString: "1d100"
  },
  disadvantage: {
    label: "Mosh.Disadvantage",
    icon: "fas fa-angle-double-down",
    rollString: "1d100 [-]"
  }
});

function getSheetRoot(sheet, html) {
  if (sheet?.element instanceof HTMLElement) return sheet.element;
  if (sheet?.element?.[0] instanceof HTMLElement) return sheet.element[0];
  if (html?.[0] instanceof HTMLElement) return html[0];
  return html instanceof HTMLElement ? html : null;
}

function isSbtShipSheet(sheet) {
  if (sheet?.actor?.type !== "ship") return false;

  const template = sheet?.options?.template ?? sheet?.template ?? "";
  return template === SBT_TEMPLATE || sheet?.constructor?.name === "MothershipShipSheetSBT";
}

function getActiveRosterUuids(ship) {
  const roster = ship?.getFlag?.(MODULE_ID, FLAG_CREW_ROSTER);
  const uuids = [];
  const seen = new Set();

  for (const tab of ["character", "creature"]) {
    const entries = Array.isArray(roster?.[tab]) ? roster[tab] : [];

    for (const sourceEntry of entries) {
      const entry = typeof sourceEntry === "string"
        ? { uuid: sourceEntry, active: true }
        : sourceEntry;
      const uuid = typeof entry?.uuid === "string" ? entry.uuid.trim() : "";

      if (!uuid || entry?.active === false || seen.has(uuid)) continue;
      seen.add(uuid);
      uuids.push(uuid);
    }
  }

  return uuids;
}

function getSkillBonus(item) {
  const bonus = Number(item?.system?.bonus);
  return Number.isFinite(bonus) && bonus > 0 ? bonus : null;
}

async function getCrewSkillGroups(ship) {
  const actors = await Promise.all(getActiveRosterUuids(ship).map((uuid) => fromUuid(uuid)));
  const groups = [];

  for (const actor of actors) {
    if (actor?.documentName !== "Actor") continue;
    if (actor.type !== "character" && actor.type !== "creature") continue;

    const skills = Array.from(actor.items ?? [])
      .filter((item) => item.type === "skill")
      .map((item) => ({
        item,
        bonus: getSkillBonus(item)
      }))
      .filter((entry) => entry.bonus !== null)
      .sort((left, right) => (
        right.bonus - left.bonus
        || left.item.name.localeCompare(right.item.name, undefined, { sensitivity: "base" })
      ));

    if (!skills.length) continue;

    groups.push({
      actor,
      skills
    });
  }

  return groups.sort((left, right) => (
    left.actor.name.localeCompare(right.actor.name, undefined, { sensitivity: "base" })
  ));
}

export class SbtCrewSkillRollApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createQolAppDefaultOptions({
    id: `${MODULE_ID}-sbt-crew-skill-roll`,
    title: "MoshQoL.SbtCrewRoll.Title",
    windowClasses: "sbt-crew-skill-roll-dialog",
    position: { width: 640 },
    actions: {
      roll: this._onRoll,
      cancel: this._onCancel
    }
  });

  static PARTS = {
    form: {
      template: templatePath("dialogs/sbt-crew-skill-roll.html")
    }
  };

  static wait({ ship, statKey }) {
    return new Promise((resolve) => {
      const app = new this({ ship, statKey, resolve });
      app.render({ force: true });
    });
  }

  constructor({ ship, statKey, resolve }, options = {}) {
    super(options);
    this.ship = ship;
    this.statKey = statKey;
    this._resolve = resolve;
    this._resolved = false;
    this._choices = new Map();
    this._statLabel = "";
  }

  async _prepareContext() {
    const stat = this.ship?.system?.stats?.[this.statKey];
    this._statLabel = stat?.label ?? stat?.rollLabel ?? this.statKey;
    const crewGroups = await getCrewSkillGroups(this.ship);

    this._choices = new Map(MANUAL_SKILLS.map(({ rank, bonus }) => [
      `manual-${bonus}`,
      {
        skill: game.i18n.format("MoshQoL.SbtCrewRoll.ManualSkillLabel", { rank, bonus }),
        bonus
      }
    ]));

    let choiceIndex = 0;
    const renderedCrewGroups = crewGroups.map(({ actor, skills }) => ({
      name: actor.name,
      img: actor.img || MOSH_FALLBACK_ACTOR_IMAGE,
      skills: skills.map(({ item, bonus }) => {
        const id = `crew-${choiceIndex++}`;
        this._choices.set(id, {
          skill: escapeHTML(`${actor.name} — ${item.name}`),
          bonus
        });

        return {
          id,
          name: item.name,
          bonus
        };
      })
    }));

    return appendQolThemeContext({
      statLabel: this._statLabel,
      hasCrewSkills: renderedCrewGroups.length > 0,
      crewGroups: renderedCrewGroups,
      manualSkills: MANUAL_SKILLS.map(({ rank, bonus }, index) => ({
        id: `manual-${bonus}`,
        rank,
        bonus,
        checked: index === 0
      })),
      rollModes: Object.entries(ROLL_MODES).map(([id, mode]) => ({
        id,
        label: game.i18n.localize(mode.label),
        icon: mode.icon
      })),
      cancelLabel: game.i18n.localize("MoshQoL.Common.Cancel")
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.window.title = game.i18n.format("MoshQoL.SbtCrewRoll.Title", {
      stat: this._statLabel
    });
  }

  static async _onRoll(event, target) {
    event?.preventDefault?.();

    const mode = ROLL_MODES[target?.dataset?.rollMode];
    if (!mode) return;

    const root = getAppRoot(this.element);
    const selectedId = root
      ?.querySelector("input[name='crewSkill']:checked")
      ?.value ?? "manual-10";
    const selection = this._choices.get(selectedId) ?? this._choices.get("manual-10");
    if (!selection) return;

    resolveAppOnce(this, {
      rollString: mode.rollString,
      skill: selection.skill,
      bonus: selection.bonus
    });
    await this.close();
  }

  static async _onCancel(event) {
    event?.preventDefault?.();
    await this.close();
  }

  async close(options = {}) {
    resolveAppOnce(this, null);
    return super.close(options);
  }
}

async function openCrewSkillRoll(ship, statKey) {
  if (!ship || !SUPPORTED_STATS.has(statKey)) return;
  if (typeof ship.rollCheck !== "function") {
    ui.notifications.warn(game.i18n.localize("MoshQoL.SbtCrewRoll.RollUnavailable"));
    return;
  }

  const result = await SbtCrewSkillRollApp.wait({ ship, statKey });
  if (!result) return;

  await ship.rollCheck(
    result.rollString,
    "low",
    statKey,
    result.skill,
    result.bonus,
    null
  );
}

export function augmentSbtShipSkillRolls(sheet, html) {
  if (!isSbtShipSheet(sheet)) return;

  const root = getSheetRoot(sheet, html);
  if (!root) return;

  for (const statLabel of root.querySelectorAll(".stat-roll[data-key]")) {
    const statKey = statLabel.dataset.key;
    if (!SUPPORTED_STATS.has(statKey)) continue;

    const anchor = statLabel.parentElement;
    if (!anchor || anchor.querySelector(`.gbqol-sbt-crew-roll-button[data-stat-key="${statKey}"]`)) {
      continue;
    }

    anchor.classList.add("gbqol-sbt-crew-roll-anchor");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gbqol-sbt-crew-roll-button";
    button.dataset.statKey = statKey;
    button.style.setProperty("--theme-color", getThemeColor());

    const label = game.i18n.format("MoshQoL.SbtCrewRoll.Action", {
      stat: sheet.actor.system?.stats?.[statKey]?.label ?? statKey
    });
    button.title = label;
    button.setAttribute("aria-label", label);

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-user-plus";
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        await openCrewSkillRoll(sheet.actor, statKey);
      } catch (error) {
        console.error(error);
        ui.notifications.error(game.i18n.localize("MoshQoL.SbtCrewRoll.Error"));
      }
    });

    statLabel.insertAdjacentElement("afterend", button);
  }
}
