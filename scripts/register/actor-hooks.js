import { upsertToolband, removeToolband, refreshToolbandForActor } from "../toolband.js";
import { augmentSbtShipSkillRolls } from "../sbt-crew-skill-roll.js";
import { CHARACTER_CREATION_TOOLBAND_PROGRESS_KEYS, setReady } from "../character-creator/progress.js";
import { getSheetKind } from "./sheets.js";
import { getAppRoot } from "../utils/application-helpers.js";
import {
  FLAG_CHARACTER_CREATION,
  HIDE_SYSTEM_CHARACTER_CONFIG_CLASS,
  MODULE_ID,
  SETTING_ENABLE_CHARACTER_CREATOR
} from "../codex/constants.js";

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

function syncCharacterGeneratorSheetClass(sheet, html) {
  const actor = sheet?.actor;
  const root = getAppRoot(sheet?.element) ?? getAppRoot(html);
  if (!root) return;

  const hideSystemConfigureButton = actor?.type === "character"
    && game.settings.get(MODULE_ID, SETTING_ENABLE_CHARACTER_CREATOR) === true;

  root.classList.toggle(HIDE_SYSTEM_CHARACTER_CONFIG_CLASS, hideSystemConfigureButton);
}

export function registerActorHooks() {
  if (actorHooksRegistered) return;
  actorHooksRegistered = true;

  Hooks.on("renderActorSheet", (sheet, html) => {
    syncCharacterGeneratorSheetClass(sheet, html);

    const actor = sheet.actor;
    const isGM = game.user.isGM;
    const isOwner = actor?.testUserPermission?.(game.user, "OWNER") ?? false;
    if (!isGM && !isOwner) return;

    try {
      augmentSbtShipSkillRolls(sheet, html);
    } catch (e) {
      console.error(e);
    }

    const kind = getSheetKind(sheet);
    try {
      upsertToolband(sheet, html, { kind, isGM });
    } catch (e) {
      console.error(e);
    }
  });

  Hooks.on("createActor", async (actor, options, userId) => {
    // Post-create hooks run on every client; only the creator writes generator flags.
    if (actor.type !== "character" || userId !== game.user.id) return;
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
