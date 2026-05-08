// modules/mosh-greybearded-qol/toolband.js
import { checkReady, checkCompleted, setReady, setCompleted } from "./character-creator/progress.js";
import { getThemeColor } from "./utils/get-theme-color.js";
import { TrainingSkillSelectorApp } from "./character-creator/select-training-skill.js";
import { ShipCrewRosterApp } from "./ship-crew-roster.js";
import { getNormalizedToolbandConfig, isToolbandButtonEnabledInConfig } from "./settings/toolband-config.js";
import { makeToolbandButton } from "./codex/toolband-buttons.js";

const CLS = "toolband";

/** Immer Live-Root verwenden; html[0] kann ein Fragment sein */
function getRoot(sheet, html){
  return (sheet?.element?.[0]) || (html?.[0]) || null;
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
    bar.className = `${CLS} greybeardqol`;
    bar.dataset.appid = String(sheet.appId);
    winHeader.insertAdjacentElement("afterend", bar);
    bar.style.setProperty("--theme-color", getThemeColor());

    // Zentrale Click-Delegation
    bar.addEventListener("click", async (ev) => {
      const btn = ev.target.closest(`.${CLS}-btn[data-action]`);
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      const actor = sheet.actor;
      switch (btn.dataset.action) {
        case "ship-crit":
          return game.moshGreybeardQol.triggerShipCrit(null, actor.uuid);

        case "ship-crew-roster":
          if (!actor) return;
          return new ShipCrewRosterApp({ actor }).render(true);

        case "roll-character":
          return game.moshGreybeardQol.startCharacterCreation(actor);

        case "shore-leave":
          return game.moshGreybeardQol.SimpleShoreLeave.wait({ actor });

        case "training": {
          if (!actor) return;
          const trainedSkill = await TrainingSkillSelectorApp.wait({ actor });
          if (!trainedSkill) return;
          ui.notifications?.info?.(game.i18n.format("MoshQoL.Training.Learned", { actorName: actor.name, skillName: trainedSkill.name }));
          return sheet.render(false);
        }

        case "mark-ready":
          await setReady(actor);
          ui.notifications?.info?.(game.i18n.format("MoshQoL.Progress.MarkedReady", { actorName: actor.name }));
          return sheet.render(false);

        case "mark-complete":
          await setCompleted(actor);
          ui.notifications?.info?.(game.i18n.format("MoshQoL.Progress.MarkedCompleted", { actorName: actor.name }));
          return sheet.render(false);

        case "apply-damage":
          if (!actor) return;
          await game.moshGreybeardQol.applyDamage(actor);
          return;
        
        case "armor-broken": {
          if (!actor) return;
          const isActive = actor?.statuses?.has("qol-broken-armor") === true;
        
          // v13: Actor.toggleStatusEffect akzeptiert die Status-ID
          await actor.toggleStatusEffect("qol-broken-armor", { active: !isActive });
        
          // UI sofort spiegeln (kein re-render nötig)
          btn.classList.toggle("is-active", !isActive);
          btn.setAttribute("aria-pressed", String(!isActive));
          ui.notifications?.info?.(game.i18n.format("MoshQoL.Armor.State", {
            actorName: actor.name,
            state: game.i18n.localize(!isActive ? "MoshQoL.Armor.Broken" : "MoshQoL.Armor.Intact")
          }));
          return;
        }
          
        // ===== Contractor: Promote =====
        case "promote-contractor": {
          // Guard: nur GM & nur wenn die Sheet-Methoden existieren
          if (!isGM) return;
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
              await actor.update({
                "system.contractor.isNamed": true,
                "system.stats.loyalty.enabled": true
              });
              if (typeof sheet._rollContractorLoyalty === "function")   await sheet._rollContractorLoyalty(actor);
              if (typeof sheet._rollContractorMotivation === "function")await sheet._rollContractorMotivation(actor);
              if (typeof sheet._rollContractorLoadout === "function")   await sheet._rollContractorLoadout(actor);
              ui.notifications.info(game.i18n.format("MoshQoL.Contractor.Promote.Rolled", { actorName: actor.name }));
              break;
            case "manual":
              await actor.update({
                "system.contractor.isNamed": true,
                "system.stats.loyalty.enabled": true
              });
              ui.notifications.info(game.i18n.format("MoshQoL.Contractor.Promote.ManualDone", { actorName: actor.name }));
              break;
            default:
              ui.notifications.info(game.i18n.localize("MoshQoL.Contractor.Promote.Cancelled"));
              return;
          }
          return sheet.render();
        }

        // ===== Contractor: Menü =====
        case "contractor-menu": {
          if (!isGM) return;
          await foundry.applications.api.DialogV2.wait({
            window: { title: game.i18n.localize("MoshQoL.Contractor.Actions.Title") },
            content: game.i18n.localize("MoshQoL.Contractor.Actions.Content"),
            buttons: [
              {
                label: game.i18n.localize("MoshQoL.Contractor.Actions.RollLoyalty"),
                icon: "fa-solid fa-handshake",
                action: "loyalty",
                callback: async () => { 
                  if (typeof sheet._rollContractorLoyalty === "function") 
                    await sheet._rollContractorLoyalty(actor); 
                }
              },
              {
                label: game.i18n.localize("MoshQoL.Contractor.Actions.RollMotivation"),
                icon: "fa-solid fa-fire",
                action: "motivation",
                callback: async () => { 
                  if (typeof sheet._rollContractorMotivation === "function") 
                    await sheet._rollContractorMotivation(actor); 
                }
              },
              {
                label: game.i18n.localize("MoshQoL.Contractor.Actions.RollLoadout"),
                icon: "fa-solid fa-boxes-stacked",
                action: "loadout",
                callback: async () => { 
                  if (typeof sheet._rollContractorLoadout === "function") 
                    await sheet._rollContractorLoadout(actor); 
                }
              }
            ],
            default: "loyalty"
          });
          return;
        }
      }
    }, { passive: false });
  }

  // ---- Buttons bestimmen (nach Kategorie + GM-Unterkategorie) ----
  const actor = sheet.actor;
  const btns = [];

  switch (kind) {
    case "character": {
      // Nutzer-Buttons (alle Owner/Spieler) wie gehabt …
      const isCreatorEnabled = game.settings.get("mosh-greybearded-qol", "enableCharacterCreator");
      const ready = checkReady(actor);
      const completed = checkCompleted(actor);
    
      if (isCreatorEnabled && ready && !completed) {
        btns.push(makeToolbandButton("roll-character"));
        btns.push(makeToolbandButton("mark-complete"));
      } else {
        btns.push(makeToolbandButton("apply-damage"));
        // Toggle-Button Armor Broken
        const armorBroken = actor?.statuses?.has("qol-broken-armor") === true;
        btns.push(makeToolbandButton("armor-broken", { pressed: armorBroken }));
        btns.push(makeToolbandButton("shore-leave"));
      }
      btns.push(makeToolbandButton("training"));
      // GM-Unterkategorie …
      if (isGM) {
        if (!ready && !completed) {
          btns.push(makeToolbandButton("mark-ready"));
        }
      }
      break;
    }

    case "contractor": {
      // Nutzer-Buttons
      // Toggle-Button Armor Broken
      const armorBroken = actor?.statuses?.has("qol-broken-armor") === true;
      btns.push(makeToolbandButton("armor-broken", { pressed: armorBroken }));
      // GM-Unterkategorie
      if (isGM) {
        const isNamed = !!actor?.system?.contractor?.isNamed;
        if (!isNamed) {
          btns.push(makeToolbandButton("promote-contractor"));
        } else {
          btns.push(makeToolbandButton("contractor-menu"));
        }
      }
      break;
    }

    case "ship": {
      // Nutzer-Buttons
      btns.push(makeToolbandButton("ship-crit"));
      btns.push(makeToolbandButton("ship-crew-roster"));
      // GM-Unterkategorie
      if (isGM) {
        // (Platzhalter) — GM-spezifische Ship-Buttons hier ergänzen
      }
      break;
    }

    case "stash": {
      // Nutzer-Buttons
      btns.push(makeToolbandButton("ship-crew-roster"));
      // GM-Unterkategorie
      if (isGM) {
        // (Platzhalter) — Stash-GM-Aktionen hier ergänzen
      }
      break;
    }

    case "creature": {
      btns.push(makeToolbandButton("apply-damage"));
      // Toggle-Button Armor Broken
      const armorBroken = actor?.statuses?.has("qol-broken-armor") === true;
      btns.push(makeToolbandButton("armor-broken", { pressed: armorBroken }));
      // GM-Unterkategorie
      if (isGM) {
        // (Platzhalter) — Creature-GM-Aktionen hier ergänzen
      }
      break;
    }

    default: {
      // (Platzhalter) — Fallback-Actions
      if (isGM) {
        // (Platzhalter) — Fallback-GM-Actions
      }
      break;
    }
  }

  // ---- Diff/Neuaufbau ----
  const toolbandConfig = getNormalizedToolbandConfig();
  const visibleBtns = btns.filter((button) => isToolbandButtonEnabledInConfig(kind, button.id, toolbandConfig));

  const targetIds = visibleBtns.length ? visibleBtns.map(b => b.id) : ["__placeholder__"];
  const currentIds = Array.from(bar.querySelectorAll(`.${CLS}-btn`)).map(n => n.dataset.action);
  const changed = currentIds.length !== targetIds.length || currentIds.some((id, i) => id !== targetIds[i]);
  if (!changed) return;

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
