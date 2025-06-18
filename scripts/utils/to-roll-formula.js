/**
 * Converts a roll config object into a Foundry-compatible roll formula string.
 * @param {Object} config - The structured roll config.
 * @param {number} config.dice - Number of dice.
 * @param {number} config.faces - Faces per die.
 * @param {string|null} config.keep - 'h', 'high', 'kh', 'l', 'low', or 'kl'.
 * @param {number} config.bonus - Flat bonus added to the roll.
 * @param {number} config.multiplier - Multiplier applied after rolling.
 * @returns {string} Foundry-compatible roll formula.
 */
export function toRollFormula({ dice, faces, keep, bonus, multiplier }) {
  // If no dice and faces are provided, treat it as pure bonus (e.g., S-Class flat 20)
  let formula = "";
  if (dice && dice>0 && faces && faces>0) {
    formula += `${dice}d${faces}`;
    // Normalize keep syntax
    const keepNormalized = typeof keep === "string"
      ? (keep.toLowerCase().startsWith("h") ? "kh"
        : keep.toLowerCase().startsWith("l") ? "kl"
        : null)
      : null;
    if (keepNormalized) formula += keepNormalized;
  }
  
  if (bonus) formula += ` + ${bonus}`;
  if (multiplier && multiplier > 1) formula = `(${formula}) * ${multiplier}`;

  return formula;
}
