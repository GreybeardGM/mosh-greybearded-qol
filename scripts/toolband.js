/**
 * Fügt/aktualisiert ein Menüband unmittelbar unter dem Sheet-Header.
 * Idempotent; ersetzt nur den Band-Inhalt bei Änderungen.
 */
export function upsertToolband(sheet, html) {
  const actor = sheet.actor;
  const isGM = game.user.isGM;
  const isOwner = actor?.testUserPermission(game.user, "OWNER");
  if (!(isGM || isOwner)) return;

  // Stash-Sheet ausnehmen wie bisher
  const isStash = (typeof StashSheet !== "undefined") && sheet instanceof StashSheet;
  if (isStash) return;

  const root = html?.[0];
  if (!root) return;

  // === KORREKTER ANKER ===
  // 1) Primär: Fenster-Header (".window-header")
  // 2) Sekundär: falls nicht vorhanden, vor ".window-content" einfügen
  const winHeader = root.querySelector(".window-header");
  const winContent = root.querySelector(".window-content");
  if (!winHeader && !winContent) return;

  // Existierendes Band?
  let bar = root.querySelector(`.gbqol-toolband[data-appid="${sheet.appId}"]`);
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "gbqol-toolband";
    bar.dataset.appid = String(sheet.appId);

    // Einfügeposition: direkt NACH dem Fenster-Header,
    // dadurch liegt das Band visuell zwischen Header und Content.
    if (winHeader) {
      winHeader.insertAdjacentElement("afterend", bar);
    } else {
      // Notfall: vor den Inhalt setzen
      winContent.insertAdjacentElement("beforebegin", bar);
    }

    // Delegiertes Click-Handling einmalig
    bar.addEventListener("click", async (ev) => {
      const btn = ev.target.closest(".gbqol-toolband-btn[data-action]");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
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

  // Buttons gemäß deinen bestehenden Regeln
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

  // Wenn keine Buttons nötig sind, Band entfernen
  if (!buttons.length) { bar.remove(); return; }

  // Diff: Nur neu bauen, wenn sich die Reihenfolge/Anzahl geändert hat
  const innerIds = Array.from(bar.querySelectorAll(".gbqol-toolband-btn")).map(n => n.dataset.action);
  const targetIds = buttons.map(b => b.id);
  const changed = innerIds.length !== targetIds.length || innerIds.some((id, i) => id !== targetIds[i]);
  if (!changed) return;

  bar.innerHTML = buttons.map(b => `
    <button type="button" class="gbqol-toolband-btn" data-action="${b.id}" title="${b.label}" style="--gbqol-btn-color:${b.color}">
      <i class="${b.icon}" aria-hidden="true"></i><span>${b.label}</span>
    </button>
  `).join("") + `<div class="gbqol-spacer"></div>`;
}

/** Cleanup beim Schließen */
export function removeToolband(sheet) {
  document.querySelectorAll(`.gbqol-toolband[data-appid="${sheet.appId}"]`).forEach(el => el.remove());
}
