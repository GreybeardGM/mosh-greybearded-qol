import { normalizeKeepToken } from "./normalization.js";

function getRollBase({ dice, faces, keep }, { foundryFormula = false } = {}) {
  if (!dice || dice <= 0 || !faces || faces <= 0) return "";

  const base = `${dice}d${faces}`;
  const normalizedKeep = normalizeKeepToken(keep);

  if (normalizedKeep === "+" || normalizedKeep === "-") {
    return foundryFormula
      ? `{${base},${base}}${normalizedKeep === "+" ? "kh" : "kl"}`
      : `${base} [${normalizedKeep}]`;
  }

  return `${base}${normalizedKeep || ""}`;
}

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
  let formula = getRollBase({ dice, faces, keep }, { foundryFormula: true });

  if (bonus && bonus !== 0) formula += ` + ${bonus}`;
  if (multiplier && multiplier > 1) formula = `(${formula}) * ${multiplier}`;

  return formula || "0";
}

/**
 * Converts a roll config object into a human-readable roll string.
 * @param {Object} config - The structured roll config.
 * @param {number} config.dice - Number of dice.
 * @param {number} config.faces - Faces per die.
 * @param {string|null} config.keep - 'h', 'high', 'kh', 'l', 'low', 'kl', '+' or '-'.
 * @param {number} config.bonus - Flat bonus added to the roll.
 * @param {number} config.multiplier - Multiplier applied after rolling.
 * @returns {string} Human-readable roll description.
 */
export function toRollString({ dice, faces, keep, bonus, multiplier }) {
  let formula = getRollBase({ dice, faces, keep });

  if (bonus && bonus !== 0) formula += ` + ${bonus}`;

  if (multiplier && multiplier > 1) {
    let suffix = `x ${multiplier}`;
    if (multiplier % 1000000 === 0) suffix = `x ${multiplier / 1000000}M`;
    else if (multiplier % 1000 === 0) suffix = `x ${multiplier / 1000}k`;
    formula = `(${formula}) ${suffix}`;
  }

  return formula || "0";
}
