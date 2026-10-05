/** Pure currency interpreter. Never guess, truncate, round, or discard input characters. */
export function classifyCurrency(input, { notation = null } = {}) {
  const invalid = code => ({ status: "invalid", code });
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return invalid("not_finite");
    if (input < 0) return invalid("negative_credits");
    if (!Number.isInteger(input)) return invalid("fractional_credits");
    if (!Number.isSafeInteger(input)) return invalid("integer_out_of_range");
    return { status: "success", value: input };
  }
  if (typeof input !== "string") return invalid("unsupported_type");
  if (!input.length) return invalid("empty");
  if (/[^0-9.,GMkCcRr ]/.test(input)) return invalid("forbidden_character");

  const match = input.match(/^([0-9]+(?:[.,][0-9]+)*)(?: ?([GMk](?:[cC][rR])?|[cC][rR]))?$/);
  if (!match) return invalid("invalid_structure");
  const [, numericPart, suffix = ""] = match;
  const multiplier = suffix.startsWith("G") ? 1_000_000_000n
    : suffix.startsWith("M") ? 1_000_000n : suffix.startsWith("k") ? 1_000n : 1n;
  const notations = [
    { id: "de", pattern: /^(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+)(?:,[0-9]+)?$/, group: ".", decimal: "," },
    { id: "en", pattern: /^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]+)?$/, group: ",", decimal: "." }
  ];
  if (notation !== null && !notations.some(item => item.id === notation)) return invalid("invalid_notation");
  const interpretations = [];
  for (const rule of notations) {
    if (notation !== null && rule.id !== notation) continue;
    if (!rule.pattern.test(numericPart)) continue;
    const [whole, fraction = ""] = numericPart.split(rule.group).join("").split(rule.decimal);
    const numerator = BigInt(whole + fraction) * multiplier;
    const denominator = 10n ** BigInt(fraction.length);
    const integerPart = numerator / denominator;
    const remainder = numerator % denominator;
    const decimalPart = remainder === 0n ? ""
      : remainder.toString().padStart(fraction.length, "0").replace(/0+$/, "");
    interpretations.push({
      notation: rule.id,
      credits: integerPart.toString() + (decimalPart ? "." + decimalPart : ""),
      integerPart,
      remainder
    });
  }
  if (!interpretations.length) return invalid("invalid_notation");

  // Keep fractional candidates until the user chooses a notation: the integer
  // requirement must never silently turn 1,234 into a thousands interpretation.
  if (new Set(interpretations.map(item => item.credits)).size > 1) {
    return {
      status: "unclear", code: "ambiguous_separator",
      candidates: interpretations.map(({ notation: id, credits }) => ({ notation: id, credits }))
    };
  }
  const result = interpretations[0];
  const notationsFound = interpretations.map(item => item.notation);
  if (result.remainder !== 0n) {
    return { ...invalid("fractional_credits"), notations: notationsFound, credits: result.credits };
  }
  if (result.integerPart > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ...invalid("integer_out_of_range"), notations: notationsFound, credits: result.credits };
  }
  return { status: "success", value: Number(result.integerPart), notations: notationsFound };
}

/** Display only. External input must first be resolved with readCurrency(). */
export function formatCurrency(value, { locale = globalThis.game?.i18n?.lang } = {}) {
  const parsed = classifyCurrency(value);
  if (parsed.status !== "success") throw new RangeError(`Unresolved currency: ${parsed.code}`);
  const amount = parsed.value;
  const options = { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true };
  for (const [divisor, suffix] of [[1_000_000_000, "Gcr"], [1_000_000, "Mcr"], [1_000, "kcr"]]) {
    if (amount !== 0 && amount % (divisor / 10) === 0) {
      return `${(amount / divisor).toLocaleString(locale, options)} ${suffix}`;
    }
  }
  return `${amount.toLocaleString(locale, { useGrouping: true })} cr`;
}
