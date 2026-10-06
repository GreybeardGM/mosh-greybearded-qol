import { CURRENCY_NOTATIONS, getCreditConfig } from "../currency/config.js";

/** Never guess, truncate, round, or discard input characters. Only the chosen notation applies. */
export function classifyCurrency(input, { notation = getCreditConfig().notation } = {}) {
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
  if (/[^0-9.,'\u2019\u00a0\u202fGMkCcRr ]/.test(input)) return invalid("forbidden_character");

  const match = input.match(/^([0-9]+(?:[., '\u2019\u00a0\u202f][0-9]+)*)(?: ?([GMk](?:[cC][rR])?|[cC][rR]))?$/);
  if (!match) return invalid("invalid_structure");
  const [, numericPart, suffix = ""] = match;
  const rule = Object.hasOwn(CURRENCY_NOTATIONS, notation) ? CURRENCY_NOTATIONS[notation] : null;
  if (!rule?.pattern.test(numericPart)) return invalid("invalid_notation");
  const multiplier = suffix.startsWith("G") ? 1_000_000_000n
    : suffix.startsWith("M") ? 1_000_000n : suffix.startsWith("k") ? 1_000n : 1n;
  const [whole, fraction = ""] = numericPart.replace(rule.groups, "").split(rule.decimal);
  const numerator = BigInt(whole + fraction) * multiplier;
  const denominator = 10n ** BigInt(fraction.length);
  if (numerator % denominator !== 0n) return invalid("fractional_credits");
  const amount = numerator / denominator;
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) return invalid("integer_out_of_range");
  return { status: "success", value: Number(amount) };
}

/** Display only. The world notation applies even when automatic credit handling is off. */
export function formatCurrency(value, { notation = getCreditConfig().notation } = {}) {
  const parsed = classifyCurrency(value, { notation });
  const rule = Object.hasOwn(CURRENCY_NOTATIONS, notation) ? CURRENCY_NOTATIONS[notation] : null;
  if (parsed.status !== "success" || !rule) throw new RangeError(`Unresolved currency: ${parsed.code ?? "invalid_notation"}`);
  const amount = BigInt(parsed.value);
  const grouped = digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, rule.group);
  // Integer arithmetic keeps display and re-reading exact, including near MAX_SAFE_INTEGER.
  for (const [divisor, suffix] of [[1_000_000_000n, "Gcr"], [1_000_000n, "Mcr"], [1_000n, "kcr"]]) {
    if (amount !== 0n && amount % (divisor / 10n) === 0n) {
      return `${grouped((amount / divisor).toString())}${rule.decimal}${(amount % divisor) / (divisor / 10n)} ${suffix}`;
    }
  }
  return `${grouped(amount.toString())} cr`;
}
