import { APPLY_DAMAGE_VISIBILITY } from "../settings/apply-damage-config.js";
import { getApplyDamageVisibilitySetting } from "./visibility.js";

const TARGET_LOGIC_SETTING = "applyDamageTargetLogic";
const MODULE_ID = "mosh-greybearded-qol";
const DEFAULT_TARGET_LOGIC = "alwaysCharacter";
const VALID_TARGET_LOGICS = new Set(["alwaysCharacter", "alwaysToken", "characterFirst", "tokenFirst"]);

/**
 * Apply-Damage-Policy für UI-Sichtbarkeit und Target-Auflösung.
 *
 * Wichtig: UI-Sichtbarkeit != Ausführungserlaubnis.
 * Diese Policy kapselt nur, ob UI-Elemente angezeigt werden und wie Targets
 * im aktuellen Kontext aufgelöst werden.
 */
export function canShowApplyDamageUI(user = game.user) {
  const visibility = getApplyDamageVisibilitySetting();
  if (visibility === APPLY_DAMAGE_VISIBILITY.DISABLED) return false;
  if (user?.isGM) return true;
  if (visibility === APPLY_DAMAGE_VISIBILITY.EVERYONE) return true;
  return visibility === APPLY_DAMAGE_VISIBILITY.TRUSTED && user?.isTrusted === true;
}

export function getApplyDamageTargetLogicSetting() {
  const value = game.settings.get(MODULE_ID, TARGET_LOGIC_SETTING);
  return VALID_TARGET_LOGICS.has(value) ? value : DEFAULT_TARGET_LOGIC;
}

export async function resolveApplyDamageTargets(actorLike, context = {}) {
  const direct = resolveActorLike(actorLike);
  if (direct) return [direct];

  const character = getUserCharacterTarget(context);
  const tokenActors = getControlledTokenTargets(context);

  switch (getApplyDamageTargetLogicSetting()) {
    case "alwaysToken":
      return tokenActors;
    case "characterFirst":
      return character ? [character] : tokenActors;
    case "tokenFirst":
      return tokenActors.length ? tokenActors : (character ? [character] : []);
    case "alwaysCharacter":
    default:
      return character ? [character] : [];
  }
}

function resolveActorLike(actorLike) {
  if (!actorLike) return null;
  if (actorLike instanceof Actor) return actorLike;
  if (actorLike?.actor instanceof Actor) return actorLike.actor;
  if (actorLike?.document?.actor instanceof Actor) return actorLike.document.actor;
  if (typeof actorLike === "string") return game.actors?.get(actorLike) ?? null;
  return null;
}

function getUserCharacterTarget(context) {
  const character = (context.user ?? game.user)?.character;
  return character instanceof Actor ? character : null;
}

function getControlledTokenTargets(context) {
  const controlled = context.controlledTokens ?? canvas?.tokens?.controlled ?? [];
  const actors = [];
  const seen = new Set();

  for (const token of controlled) {
    const actor = token?.actor;
    if (!(actor instanceof Actor) || seen.has(actor)) continue;
    seen.add(actor);
    actors.push(actor);
  }

  return actors;
}
