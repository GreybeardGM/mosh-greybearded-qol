import { upsertToolband, removeToolband } from "../toolband.js";
import { setReady } from "../character-creator/progress.js";
import { getSheetKind } from "./sheets.js";

export function registerActorHooks() {
  Hooks.on("renderActorSheet", (sheet, html) => {
    const actor = sheet.actor;
    const isGM = game.user.isGM;
    const isOwner = actor?.testUserPermission?.(game.user, "OWNER") ?? false;
    if (!isGM && !isOwner) return;

    const kind = getSheetKind(sheet);
    try {
      upsertToolband(sheet, html, { kind, isGM });
    } catch (e) {
      console.error(e);
    }
  });

  Hooks.on("createActor", async (actor, options, userId) => {
    if (actor.type !== "character") return;
    await setReady(actor);
  });

  Hooks.on("closeActorSheet", (sheet) => {
    try {
      removeToolband(sheet);
    } catch (e) {
      console.error(e);
    }
  });
}
