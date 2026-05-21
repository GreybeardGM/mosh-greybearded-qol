import { getNormalizedApplyDamageConfig } from "../settings/apply-damage-config.js";

export const APPLY_DAMAGE_VISIBILITY = {
  DISABLED: "disabled",
  GM_ONLY: "gmOnly",
  TRUSTED: "trusted",
  EVERYONE: "everyone"
};

const VALID_TARGET_LOGICS = ["alwaysCharacter", "alwaysToken", "characterFirst", "tokenFirst"];

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
  if (visibility === APPLY_DAMAGE_VISIBILITY.TRUSTED) return user?.isTrusted === true;
  return false;
}

export function getApplyDamageTargetLogicSetting() {
  const value = game.settings.get("mosh-greybearded-qol", "applyDamageTargetLogic");
  return VALID_TARGET_LOGICS.includes(value) ? value : VALID_TARGET_LOGICS[0];
}

export async function resolveApplyDamageTargets(actorLike, context = {}) {
  const direct = await resolveActorLike(actorLike);
  if (direct) return [direct];

  const mode = getApplyDamageTargetLogicSetting();
  const providers = {
    character: getUserCharacterTarget(context),
    tokenActors: getControlledTokenTargets(context)
  };

  const strategy = TARGET_LOGIC_STRATEGIES[mode] ?? TARGET_LOGIC_STRATEGIES.alwaysCharacter;
  return strategy(providers);
}

function getApplyDamageVisibilitySetting() {
  const value = getNormalizedApplyDamageConfig().visibility;
  return Object.values(APPLY_DAMAGE_VISIBILITY).includes(value)
    ? value
    : APPLY_DAMAGE_VISIBILITY.GM_ONLY;
}

async function resolveActorLike(actorLike) {
  if (!actorLike) return null;
  if (actorLike instanceof Actor) return actorLike;
  if (actorLike?.actor instanceof Actor) return actorLike.actor;
  if (typeof actorLike === "string") return game.actors?.get(actorLike) ?? null;
  if (actorLike.document?.actor instanceof Actor) return actorLike.document.actor;
  return null;
}

function getUserCharacterTarget(context) {
  const user = context.user ?? game.user;
  const character = user?.character;
  return character instanceof Actor ? character : null;
}

function getControlledTokenTargets(context) {
  const controlled = context.controlledTokens ?? canvas?.tokens?.controlled ?? [];
  const tokenActors = controlled
    .map((token) => token?.actor ?? null)
    .filter((actor) => actor instanceof Actor);
  return [...new Set(tokenActors)];
}

function targetStrategyAlwaysCharacter({ character }) {
  return character ? [character] : [];
}

function targetStrategyAlwaysToken({ tokenActors }) {
  return tokenActors;
}

function targetStrategyCharacterFirst({ character, tokenActors }) {
  return character ? [character] : tokenActors;
}

function targetStrategyTokenFirst({ character, tokenActors }) {
  return tokenActors.length ? tokenActors : (character ? [character] : []);
}

const TARGET_LOGIC_STRATEGIES = {
  alwaysCharacter: targetStrategyAlwaysCharacter,
  alwaysToken: targetStrategyAlwaysToken,
  characterFirst: targetStrategyCharacterFirst,
  tokenFirst: targetStrategyTokenFirst
};
