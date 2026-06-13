import { upsertToolband, removeToolband, refreshToolbandForActor } from "../toolband.js";
import { CHARACTER_CREATION_TOOLBAND_PROGRESS_KEYS, setReady } from "../character-creator/progress.js";
import { getSheetKind } from "./sheets.js";
import { FLAG_CHARACTER_CREATION, MODULE_ID } from "../codex/constants.js";

let actorHooksRegistered = false;

function hasCharacterCreationProgressChange(changed) {
  const moduleFlags = changed?.flags?.[MODULE_ID];
  const progressChanges = moduleFlags?.[FLAG_CHARACTER_CREATION];
  const hasProgressKey = (key) => Object.hasOwn(progressChanges ?? {}, key)
    || Object.hasOwn(changed ?? {}, `flags.${MODULE_ID}.${FLAG_CHARACTER_CREATION}.${key}`);

  return Object.hasOwn(moduleFlags ?? {}, `-=${FLAG_CHARACTER_CREATION}`)
    || Object.hasOwn(changed ?? {}, `flags.${MODULE_ID}.-=${FLAG_CHARACTER_CREATION}`)
    || CHARACTER_CREATION_TOOLBAND_PROGRESS_KEYS.some(hasProgressKey);
}

export function registerActorHooks() {
  if (actorHooksRegistered) return;
  actorHooksRegistered = true;

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

  Hooks.on("updateActor", (actor, changed) => {
    if (actor.type !== "character" || !hasCharacterCreationProgressChange(changed)) return;

    try {
      refreshToolbandForActor(actor);
    } catch (e) {
      console.error(e);
    }
  });

  Hooks.on("closeActorSheet", (sheet) => {
    try {
      removeToolband(sheet);
    } catch (e) {
      console.error(e);
    }
  });
}
