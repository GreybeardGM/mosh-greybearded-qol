/**
 * Fügt/aktualisiert ein Menüband unmittelbar unter dem Sheet-Header.
 * Idempotent; ersetzt nur den Band-Inhalt bei Änderungen.
 */
export function upsertToolband(sheet, html) {
  const actor = sheet.actor;
  // Owner/GM-Gate wie bei Header-Buttons
  const isGM = game.user.isGM;
  const isOwner = actor?.testUserPermission(game.user, "OWNER");
  if (!(isGM || isOwner)) return;

  // Stash-Sheet wie im Header-Button-Block ausnehmen
  const isStash = (typeof StashSheet !== "undefined") && sheet instanceof StashSheet;
  if (isStash) return;

  // Zielanker bestimmen
  const root = html?.[0];
  if (!root) return;
  const headerAnchor = root.querySelector(".sheet-header") || root.querySelector(".window-content");
  if (!headerAnchor) return;

  // Band-Container holen/erzeugen
  const sel = `.gbqol-toolband[data-appid="${sheet.appId}"]`;
  let bar = root.querySelector(sel);
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "gbqol-toolband";
    bar.dataset.appid = String(sheet.appId);
    // Nach Header einfügen
    headerAnchor.insertAdjacentElement("afterend", bar);

    // Delegiertes Click-Handling einmalig setzen
    bar.addEventListener("click", async (ev) => {
      const btn = ev.target.closest(".gbqol-toolband-btn[data-action]");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      const action = btn.dataset.action;
      try {
        switch (action) {
          case "ship-crit":
            await game.moshGreybeardQol.triggerShipCrit(null, actor.uuid);
            break;
          case "roll-character":
            await game.moshGreybeardQol.startCharacterCreation(actor);
            break;
          case "shore-leave":
            await game.moshGreybeardQol.simpleShoreLeave(actor);
            break;
          default:
            ui.notifications.warn(`Unknown toolband action: ${action}`);
        }
      } catch (e) {
        console.error(e);
        ui.notifications.error(e?.message ?? "Action failed");
      }
    }, { passive: false });
  }

  // Buttons gemäß aktueller Bedingungen bestimmen
  const buttons = [];
  if (actor?.type === "ship" && game.settings.get("mosh-greybearded-qol", "enableShipCrits")) {
    buttons.push({ id: "ship-crit", icon: "fas fa-explosion", label: "Crit", color: "#f50" });
  }

  if (actor?.type === "character") {
    const isCreatorEnabled = game.settings.get("mosh-greybearded-qol", "enableCharacterCreator");
    const isReady = checkReady(actor) && !checkCompleted(actor);
    if (isCreatorEnabled && isReady) {
      buttons.push({ id: "roll-character", icon: "fas fa-dice-d20", label: "Roll Character", color: "#5f0" });
    } else {
      buttons.push({ id: "shore-leave", icon: "fas fa-umbrella-beach", label: "Shore Leave", color: "#3cf" });
    }
  }

  // Wenn keine Buttons angezeigt werden sollen, Band entfernen
  if (!buttons.length) { bar.remove(); return; }

  // Diff: Nur neu rendern, wenn sich die Button-Reihenfolge/Anzahl geändert hat
  const current = Array.from(bar.querySelectorAll(".gbqol-toolband-btn")).map(b => b.dataset.action);
  const target = buttons.map(b => b.id);
  const changed = current.length !== target.length || current.some((id, i) => id !== target[i]);

  if (!changed) return;

  // Neuaufbau
  bar.innerHTML = buttons.map(b => {
    return `<button type="button" class="gbqol-toolband-btn" data-action="${b.id}" title="${b.label}" style="--gbqol-btn-color:${b.color}">
      <i class="${b.icon}" aria-hidden="true"></i><span>${b.label}</span>
    </button>`;
  }).join("") + `<div class="gbqol-spacer"></div>`;
}

/** Cleanup beim Schließen */
export function removeToolband(sheet) {
  document.querySelectorAll(`.gbqol-toolband[data-appid="${sheet.appId}"]`).forEach(el => el.remove());
}
