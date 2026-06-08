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
