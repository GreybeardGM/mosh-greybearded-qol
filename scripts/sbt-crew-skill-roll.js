import { FLAG_CREW_ROSTER, MODULE_ID, qolWindowClasses, templatePath } from "./codex/constants.js";
import { MOSH_FALLBACK_ACTOR_IMAGE } from "./codex/mosh-system.js";
import { escapeHTML } from "./utils/html-safety.js";
import { getThemeColor } from "./utils/get-theme-color.js";

const SBT_TEMPLATE = "systems/mosh/templates/actor/ship-sheet-sbt.html";
const SUPPORTED_STATS = new Set(["thrusters", "battle", "systems"]);
const MANUAL_SKILLS = [
  { rank: "Trained", bonus: 10 },
  { rank: "Expert", bonus: 15 },
  { rank: "Master", bonus: 20 }
];

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

function createRollButton(label, icon, action, rollString, choices) {
  return {
    label,
    icon,
    action,
    callback: (_event, button) => {
      const selectedId = button.form
        ?.querySelector("input[name='crewSkill']:checked")
        ?.value ?? "manual-10";
      const selection = choices.get(selectedId) ?? choices.get("manual-10");

      return {
        rollString,
        skill: selection.skill,
        bonus: selection.bonus
      };
    }
  };
}

async function openCrewSkillRoll(ship, statKey) {
  if (!ship || !SUPPORTED_STATS.has(statKey)) return;
  if (typeof ship.rollCheck !== "function") {
    ui.notifications.warn(game.i18n.localize("MoshQoL.SbtCrewRoll.RollUnavailable"));
    return;
  }

  const stat = ship.system?.stats?.[statKey];
  const statLabel = stat?.label ?? stat?.rollLabel ?? statKey;
  const crewGroups = await getCrewSkillGroups(ship);
  const choices = new Map(MANUAL_SKILLS.map(({ rank, bonus }) => [
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
      choices.set(id, {
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

  const content = await foundry.applications.handlebars.renderTemplate(
    templatePath("dialogs/sbt-crew-skill-roll.html"),
    {
      statLabel,
      themeColor: getThemeColor(),
      hasCrewSkills: renderedCrewGroups.length > 0,
      crewGroups: renderedCrewGroups,
      manualSkills: MANUAL_SKILLS.map(({ rank, bonus }, index) => ({
        id: `manual-${bonus}`,
        rank,
        bonus,
        checked: index === 0
      }))
    }
  );

  const result = await foundry.applications.api.DialogV2.wait({
    window: {
      title: game.i18n.format("MoshQoL.SbtCrewRoll.Title", { stat: statLabel })
    },
    classes: qolWindowClasses("sbt-crew-skill-roll-dialog"),
    position: { width: 640 },
    content,
    buttons: [
      createRollButton(
        game.i18n.localize("Mosh.Advantage"),
        "fas fa-angle-double-up",
        "advantage",
        "1d100 [+]",
        choices
      ),
      createRollButton(
        game.i18n.localize("Mosh.Normal"),
        "fas fa-minus",
        "normal",
        "1d100",
        choices
      ),
      createRollButton(
        game.i18n.localize("Mosh.Disadvantage"),
        "fas fa-angle-double-down",
        "disadvantage",
        "1d100 [-]",
        choices
      ),
      {
        label: game.i18n.localize("MoshQoL.Common.Cancel"),
        icon: "fas fa-times",
        action: "cancel",
        callback: () => null
      }
    ],
    default: "normal",
    rejectClose: false
  });

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
