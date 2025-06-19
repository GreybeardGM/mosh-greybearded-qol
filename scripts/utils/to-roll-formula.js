/**
 * Converts a roll config object into a Foundry-compatible roll formula string.
 * @param {Object} config - The structured roll config.
 * @param {number} config.dice - Number of dice.
 * @param {number} config.faces - Faces per die.
 * @param {string|null} config.keep - 'h', 'high', 'kh', 'l', 'low', 'kl', '+' or '-'.
 * @param {number} config.bonus - Flat bonus added to the roll.
 * @param {number} config.multiplier - Multiplier applied after rolling.
 * @returns {string} Foundry-compatible roll formula.
 */
export function toRollFormula({ dice, faces, keep, bonus, multiplier }) {
  let formula = "";

  if (dice && dice > 0 && faces && faces > 0) {
    formula += `${dice}d${faces}`;

    // Handle special double-roll advantage/disadvantage syntax
    if (keep === "+" || keep === "-") {
      formula = `{${formula},${formula}}`;
      formula += keep === "+" ? "kh" : "kl";
    } else if (typeof keep === "string") {
      const normalized = keep.toLowerCase();
      if (normalized === "kh" || normalized === "h" || normalized === "high") {
        formula += "kh";
      } else if (normalized === "kl" || normalized === "l" || normalized === "low") {
        formula += "kl";
      }
    }
  }

  if (bonus && bonus !== 0) formula += ` + ${bonus}`;
  if (multiplier && multiplier > 1) formula = `(${formula}) * ${multiplier}`;

  return formula || "0";
}
