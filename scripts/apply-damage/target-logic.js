export const DEFAULT_TARGET_LOGIC = "alwaysCharacter";

export const VALID_TARGET_LOGICS = [
  "alwaysCharacter",
  "alwaysToken",
  "characterFirst",
  "tokenFirst"
];

export const TARGET_LOGIC_CHOICE_KEYS = {
  alwaysCharacter: "MoshQoL.Settings.ApplyDamageTargetLogic.Choices.AlwaysCharacter",
  alwaysToken: "MoshQoL.Settings.ApplyDamageTargetLogic.Choices.AlwaysToken",
  characterFirst: "MoshQoL.Settings.ApplyDamageTargetLogic.Choices.CharacterFirst",
  tokenFirst: "MoshQoL.Settings.ApplyDamageTargetLogic.Choices.TokenFirst"
};

/** Linked tokens share an Actor UUID; separate synthetic token Actors must stay distinct. */
export function getUniqueActorsFromTargets(targets) {
  const rawList = Array.isArray(targets) ? targets : [targets];
  const seen = new Set();
  return rawList.flatMap(target => {
    const actor = target?.actor ?? target;
    if (!actor) return [];
    const key = actor.uuid ?? actor.id ?? actor;
    if (seen.has(key)) return [];
    seen.add(key);
    return [actor];
  });
}
