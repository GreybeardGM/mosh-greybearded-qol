export function registerModuleApi({
  convertStress,
  SimpleShoreLeave,
  triggerShipCrit,
  startCharacterCreation,
  applyDamage,
  readCurrency,
  classifyCurrency
}) {
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;
  game.moshGreybeardQol.SimpleShoreLeave = SimpleShoreLeave;
  game.moshGreybeardQol.triggerShipCrit = triggerShipCrit;
  game.moshGreybeardQol.startCharacterCreation = startCharacterCreation;
  game.moshGreybeardQol.applyDamage = applyDamage;
  game.moshGreybeardQol.readCurrency = readCurrency;
  game.moshGreybeardQol.classifyCurrency = classifyCurrency;
}
