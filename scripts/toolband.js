// modules/mosh-greybearded-qol/toolband.js
import { checkReady, checkCompleted, setReady, setCompleted } from "./character-creator/progress.js";
import { getThemeColor } from "./utils/get-theme-color.js";
import { TrainingSkillSelectorApp } from "./character-creator/select-training-skill.js";
import { ShipCrewRosterApp } from "./ship-crew-roster.js";
import { getNormalizedToolbandConfig, isToolbandButtonEnabledInConfig } from "./settings/toolband-config.js";
import { makeToolbandButton } from "./codex/toolband-buttons.js";
import { MODULE_ID, SETTING_ENABLE_CHARACTER_CREATOR, STATUS_ARMOR_BROKEN } from "./codex/constants.js";

const CLS = "toolband";

/** Immer Live-Root verwenden; html[0] kann ein Fragment sein */
function getRoot(sheet, html){
  return (sheet?.element?.[0]) || (html?.[0]) || null;
}

function addArmorBrokenButton(buttons, actor) {
  buttons.push(makeToolbandButton("armor-broken", {
    pressed: actor?.statuses?.has(STATUS_ARMOR_BROKEN) === true
  }));
}

export function syncArmorBrokenToolbandButton(actor) {
  const active = actor.statuses.has(STATUS_ARMOR_BROKEN);

  for (const app of Object.values(ui.windows)) {
    if (app.actor?.uuid !== actor.uuid) continue;

    const button = app.element?.[0]?.querySelector(`.toolband[data-appid="${app.appId}"] .toolband-btn[data-action="armor-broken"]`);
    if (!button) continue;

    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function getToolbandButtons({ actor, kind, isGM }) {
  const buttons = [];

  switch (kind) {
    case "character": {
      const isCreatorEnabled = game.settings.get(MODULE_ID, SETTING_ENABLE_CHARACTER_CREATOR);
      const ready = checkReady(actor);
      const completed = checkCompleted(actor);

      if (isCreatorEnabled && ready && !completed) {
        buttons.push(makeToolbandButton("roll-character"), makeToolbandButton("mark-complete"));
      } else {
        buttons.push(makeToolbandButton("apply-damage"));
        addArmorBrokenButton(buttons, actor);
        buttons.push(makeToolbandButton("shore-leave"));
      }

      buttons.push(makeToolbandButton("training"));
      if (isGM && !ready && !completed) buttons.push(makeToolbandButton("mark-ready"));
      break;
    }

    case "contractor":
      addArmorBrokenButton(buttons, actor);
      if (isGM) {
        buttons.push(makeToolbandButton(actor?.system?.contractor?.isNamed ? "contractor-menu" : "promote-contractor"));
      }
      break;

    case "ship":
      buttons.push(makeToolbandButton("ship-crit"), makeToolbandButton("ship-crew-roster"));
      break;

    case "stash":
      buttons.push(makeToolbandButton("ship-crew-roster"));
      break;

    case "creature":
      buttons.push(makeToolbandButton("apply-damage"));
      addArmorBrokenButton(buttons, actor);
      break;
  }

  return buttons;
}

async function handleTrainingAction(sheet) {
  const actor = sheet?.actor;
  if (!actor) return;

  const trainedSkill = await TrainingSkillSelectorApp.wait({ actor });
  if (!trainedSkill) return;

  ui.notifications?.info?.(game.i18n.format("MoshQoL.Training.Learned", {
    actorName: actor.name,
    skillName: trainedSkill.name
  }));
  return sheet.render(false);
}

async function handleMarkReadyAction(sheet) {
  const actor = sheet?.actor;
  if (!actor) return;

  await setReady(actor);
  ui.notifications?.info?.(game.i18n.format("MoshQoL.Progress.MarkedReady", { actorName: actor.name }));
  return sheet.render(false);
}

async function handleMarkCompleteAction(sheet) {
  const actor = sheet?.actor;
  if (!actor) return;

  await setCompleted(actor);
  ui.notifications?.info?.(game.i18n.format("MoshQoL.Progress.MarkedCompleted", { actorName: actor.name }));
  return sheet.render(false);
}

async function handleArmorBrokenAction(sheet) {
  const actor = sheet?.actor;
  if (!actor) return;

  const isActive = actor?.statuses?.has(STATUS_ARMOR_BROKEN) === true;

  // v13: Actor.toggleStatusEffect akzeptiert die Status-ID
  await actor.toggleStatusEffect(STATUS_ARMOR_BROKEN, { active: !isActive });
  syncArmorBrokenToolbandButton(actor);

  ui.notifications?.info?.(game.i18n.format("MoshQoL.Armor.State", {
    actorName: actor.name,
    state: game.i18n.localize(!isActive ? "MoshQoL.Armor.Broken" : "MoshQoL.Armor.Intact")
  }));
}

async function rollContractorDetails(sheet, actor, { loyalty = false, motivation = false, loadout = false } = {}) {
  if (!actor) return;

  if (loyalty && typeof sheet?._rollContractorLoyalty === "function") {
    await sheet._rollContractorLoyalty(actor);
  }

  if (motivation && typeof sheet?._rollContractorMotivation === "function") {
    await sheet._rollContractorMotivation(actor);
  }

  if (loadout && typeof sheet?._rollContractorLoadout === "function") {
    await sheet._rollContractorLoadout(actor);
  }
}

async function markContractorNamed(actor) {
  if (!actor) return;

  await actor.update({
    "system.contractor.isNamed": true,
    "system.stats.loyalty.enabled": true
  });
}

async function handlePromoteContractorAction(sheet, { isGM = false } = {}) {
  const actor = sheet?.actor;
  if (!isGM || !actor) return;

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MoshQoL.Contractor.Promote.Title") },
    content: game.i18n.localize("MoshQoL.Contractor.Promote.Content"),
    buttons: [
      { label: game.i18n.localize("MoshQoL.Contractor.Promote.Roll"), icon: "fa-solid fa-dice", action: "roll" },
      { label: game.i18n.localize("MoshQoL.Contractor.Promote.Manual"), icon: "fa-solid fa-user-check", action: "manual" },
      { label: game.i18n.localize("MoshQoL.Common.Cancel"), icon: "fa-solid fa-xmark", action: "cancel" }
    ],
    default: "roll"
  });

  switch (choice) {
    case "roll":
      await markContractorNamed(actor);
      await rollContractorDetails(sheet, actor, { loyalty: true, motivation: true, loadout: true });
      ui.notifications?.info?.(game.i18n.format("MoshQoL.Contractor.Promote.Rolled", { actorName: actor.name }));
      break;
    case "manual":
      await markContractorNamed(actor);
      ui.notifications?.info?.(game.i18n.format("MoshQoL.Contractor.Promote.ManualDone", { actorName: actor.name }));
      break;
    default:
      ui.notifications?.info?.(game.i18n.localize("MoshQoL.Contractor.Promote.Cancelled"));
      return;
  }

  return sheet.render();
}

async function handleContractorMenuAction(sheet, { isGM = false } = {}) {
  const actor = sheet?.actor;
  if (!isGM || !actor) return;

  await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MoshQoL.Contractor.Actions.Title") },
    content: game.i18n.localize("MoshQoL.Contractor.Actions.Content"),
    buttons: [
      {
        label: game.i18n.localize("MoshQoL.Contractor.Actions.RollLoyalty"),
        icon: "fa-solid fa-handshake",
        action: "loyalty",
        callback: () => rollContractorDetails(sheet, actor, { loyalty: true })
      },
      {
        label: game.i18n.localize("MoshQoL.Contractor.Actions.RollMotivation"),
        icon: "fa-solid fa-fire",
        action: "motivation",
        callback: () => rollContractorDetails(sheet, actor, { motivation: true })
      },
      {
        label: game.i18n.localize("MoshQoL.Contractor.Actions.RollLoadout"),
        icon: "fa-solid fa-boxes-stacked",
        action: "loadout",
        callback: () => rollContractorDetails(sheet, actor, { loadout: true })
      }
    ],
    default: "loyalty"
  });
}

function handleToolbandAction(action, sheet, ctx = {}) {
  const actor = sheet?.actor;

  switch (action) {
    case "ship-crit":
      if (!actor) return;
      return game.moshGreybeardQol.triggerShipCrit(null, actor.uuid);
    case "ship-crew-roster":
      if (!actor) return;
      return new ShipCrewRosterApp({ actor }).render(true);
    case "roll-character":
      if (!actor) return;
      return game.moshGreybeardQol.startCharacterCreation(actor);
    case "shore-leave":
      if (!actor) return;
      return game.moshGreybeardQol.SimpleShoreLeave.wait({ actor });
    case "training":
      return handleTrainingAction(sheet);
    case "mark-ready":
      return handleMarkReadyAction(sheet);
    case "mark-complete":
      return handleMarkCompleteAction(sheet);
    case "apply-damage":
      if (!actor) return;
      return game.moshGreybeardQol.applyDamage(actor);
    case "armor-broken":
      return handleArmorBrokenAction(sheet);
    case "promote-contractor":
      return handlePromoteContractorAction(sheet, ctx);
    case "contractor-menu":
      return handleContractorMenuAction(sheet, ctx);
  }
}

function getButtonRenderSignature(buttons) {
  if (!buttons.length) return "__placeholder__";
  return buttons
    .map((button) => [button.id, button.label, button.icon, button.pressed === true ? "1" : "0"].join(":"))
    .join("|");
}

/** Toolband erzeugen/ankern (kein Entfernen bei leerer Buttonliste) */
export function upsertToolband(sheet, html, ctx = {}) {
  const { kind = "unknown", isGM = false } = ctx;

  // Root & Header
  const root = html?.[0];
  if (!root) return;
  root.classList.add(`has-${CLS}`);

  const winHeader = root.querySelector(".window-header");
  if (!winHeader) return;

  // Leiste erstellen (einmalig)
  let bar = root.querySelector(`.${CLS}[data-appid="${sheet.appId}"]`);
  if (!bar) {
    bar = document.createElement("div");
    bar.className = `${CLS} greybeardqol qol-ui`;
    bar.dataset.appid = String(sheet.appId);
    winHeader.insertAdjacentElement("afterend", bar);
    bar.style.setProperty("--theme-color", getThemeColor());

    // Zentrale Click-Delegation
    bar.addEventListener("click", async (ev) => {
      const btn = ev.target.closest(`.${CLS}-btn[data-action]`);
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();

      return handleToolbandAction(btn.dataset.action, sheet, { isGM });
    }, { passive: false });
  }

  const actor = sheet.actor;
  const btns = getToolbandButtons({ actor, kind, isGM });

  // ---- Diff/Neuaufbau ----
  const toolbandConfig = getNormalizedToolbandConfig();
  const visibleBtns = btns.filter((button) => isToolbandButtonEnabledInConfig(kind, button.id, toolbandConfig));

  const signature = getButtonRenderSignature(visibleBtns);
  if (bar.dataset.signature === signature) return;
  bar.dataset.signature = signature;

  if (!visibleBtns.length) {
    bar.innerHTML = `<div class="${CLS}-placeholder" data-note="no-buttons">—</div>`;
    return;
  }

  bar.innerHTML = visibleBtns.map(b => {
    const pressed = !!b.pressed;
    const classes = `${CLS}-btn pill interactive` + (pressed ? " is-active" : "");
    const aria = `aria-pressed="${pressed ? "true" : "false"}"`;
    return `
      <button type="button" class="${classes}" data-action="${b.id}" title="${b.label}" ${aria}>
        <i class="${b.icon}" aria-hidden="true"></i><span>${b.label}</span>
      </button>
    `;
  }).join("");// + `<div class="${CLS}-spacer"></div>`;

}

/** Aufräumen über App-ID */
export function removeToolband(sheet){
  const root = getRoot(sheet);
  if (!root) return;
  root.querySelectorAll(`.${CLS}[data-appid="${sheet.appId}"]`).forEach(n => n.remove());
}
