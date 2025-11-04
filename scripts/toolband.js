// modules/mosh-greybearded-qol/toolband.js
import { checkReady, checkCompleted, setReady, setCompleted } from "./character-creator/progress.js";
import { getThemeColor } from "./utils/get-theme-color.js";
import { applyDamage } from "./utils/apply-damage.js";

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

        case "roll-character":
          return game.moshGreybeardQol.startCharacterCreation(actor);

        case "shore-leave":
          return game.moshGreybeardQol.simpleShoreLeave(actor);

        case "mark-ready":
          await setReady(actor);
          ui.notifications?.info?.(`Character marked ready: ${actor.name}`);
          return sheet.render(false);

        case "mark-complete":
          await setCompleted(actor);
          ui.notifications?.info?.(`Character marked completed: ${actor.name}`);
          return sheet.render(false);

        case "apply-damage":
          if (!actor) return;
          await applyDamage(actor);
          return;

        // ===== Contractor: Promote =====
        case "promote-contractor": {
          // Guard: nur GM & nur wenn die Sheet-Methoden existieren
          if (!isGM) return;
          const choice = await foundry.applications.api.DialogV2.wait({
            window: { title: "Promote Contractor" },
            content: "<p>How would you like to promote this contractor?</p>",
            buttons: [
              { label: "Roll Contractor",  icon: "fa-solid fa-dice",        action: "roll" },
              { label: "Manual Promotion", icon: "fa-solid fa-user-check",  action: "manual" },
              { label: "Cancel",           icon: "fa-solid fa-xmark",       action: "cancel" }
            ],
            default: "roll"
          });
         
          switch (choice) {
            case "roll":
              await actor.update({ "system.contractor.isNamed": true });
              if (typeof sheet._rollContractorLoyalty === "function")   await sheet._rollContractorLoyalty(actor);
              if (typeof sheet._rollContractorMotivation === "function")await sheet._rollContractorMotivation(actor);
              if (typeof sheet._rollContractorLoadout === "function")   await sheet._rollContractorLoadout(actor);
              ui.notifications.info(`${actor.name} has been promoted and fully rolled.`);
              break;
            case "manual":
              await actor.update({ "system.contractor.isNamed": true });
              ui.notifications.info(`${actor.name} has been promoted manually.`);
              break;
            default:
              ui.notifications.info("Promotion canceled.");
              return;
          }
          return sheet.render();
        }

        // ===== Contractor: Menü =====
        case "contractor-menu": {
          if (!isGM) return;
          await foundry.applications.api.DialogV2.wait({
            window: { title: "Contractor Actions" },
            content: "<p>Select a contractor option below:</p>",
            buttons: [
              {
                label: "Roll Loyalty",
                icon: "fa-solid fa-handshake",
                action: "loyalty",
                callback: async () => { 
                  if (typeof sheet._rollContractorLoyalty === "function") 
                    await sheet._rollContractorLoyalty(actor); 
                }
              },
              {
                label: "Roll Motivation",
                icon: "fa-solid fa-fire",
                action: "motivation",
                callback: async () => { 
                  if (typeof sheet._rollContractorMotivation === "function") 
                    await sheet._rollContractorMotivation(actor); 
                }
              },
              {
                label: "Roll Loadout",
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
      // Nutzer-Buttons (alle Owner/Spieler)
      const isCreatorEnabled = game.settings.get("mosh-greybearded-qol", "enableCharacterCreator");
      const ready = checkReady(actor);
      const completed = checkCompleted(actor);

      if (isCreatorEnabled && ready && !completed) {
        btns.push({ id: "roll-character", icon: "fas fa-dice-d20", label: "Roll Character" });
        btns.push({ id: "mark-complete", icon: "fas fa-flag-checkered", label: "Mark Completed" });
      } else {
        btns.push({ id: "shore-leave", icon: "fas fa-umbrella-beach", label: "Shore Leave" });
        btns.push({ id: "apply-damage", icon: "fas fa-heart-broken", label: "Apply Damage" });
      }
      // GM-Unterkategorie
      if (isGM) {
        if (!ready && !completed) {
          btns.push({ id: "mark-ready", icon: "fas fa-check-circle", label: "Mark Ready" });
        }
      }
      break;
    }

    case "contractor": {
      // Nutzer-Buttons
      // GM-Unterkategorie
      if (isGM) {
        const isNamed = !!actor?.system?.contractor?.isNamed;
        if (!isNamed) {
          btns.push({ id: "promote-contractor", icon: "fa-solid fa-user-check", label: "Promote Unique" });
        } else {
          btns.push({ id: "contractor-menu", icon: "fa-solid fa-bars", label: "Contractor Menu" });
        }
      }
      break;
    }

    case "ship": {
      // Nutzer-Buttons
      if (game.settings.get("mosh-greybearded-qol", "enableShipCrits")) {
        btns.push({ id: "ship-crit", icon: "fas fa-explosion", label: "Roll Critical Hit" });
      }
      // GM-Unterkategorie
      if (isGM) {
        // (Platzhalter) — GM-spezifische Ship-Buttons hier ergänzen
      }
      break;
    }

    case "stash": {
      // Nutzer-Buttons
      // GM-Unterkategorie
      if (isGM) {
        // (Platzhalter) — Stash-GM-Aktionen hier ergänzen
      }
      break;
    }

    case "creature": {
      btns.push({ id: "apply-damage", icon: "fas fa-heart-broken", label: "Apply Damage" });
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
  const targetIds = btns.length ? btns.map(b => b.id) : ["__placeholder__"];
  const currentIds = Array.from(bar.querySelectorAll(`.${CLS}-btn`)).map(n => n.dataset.action);
  const changed = currentIds.length !== targetIds.length || currentIds.some((id, i) => id !== targetIds[i]);
  if (!changed) return;

  if (!btns.length) {
    bar.innerHTML = `<div class="${CLS}-placeholder" data-note="no-buttons">—</div>`;
    return;
  }

  bar.innerHTML = btns.map(b => `
    <button type="button" class="${CLS}-btn pill interactive" data-action="${b.id}" title="${b.label}">
      <i class="${b.icon}" aria-hidden="true"></i><span>${b.label}</span>
    </button>
  `).join("") + `<div class="${CLS}-spacer"></div>`;
}

/** Aufräumen über App-ID */
export function removeToolband(sheet){
  const root = getRoot(sheet);
  if (!root) return;
  root.querySelectorAll(`.${CLS}[data-appid="${sheet.appId}"]`).forEach(n => n.remove());
}
