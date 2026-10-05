export const normalizeText = (value) => String(value ?? "").trim().toLowerCase();


/**
 * Normalisiert enum-artige Foundry-Setting-Werte auf eine erlaubte Menge.
 * Bei ungültigen Werten wird bewusst auf den angegebenen Fallback zurückgefallen.
 */
export function normalizeEnum(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

export const stripHtml = (html) => String(html ?? "").replace(/<[^>]*>/g, "").trim();

export function capitalize(text, { lowerRest = false } = {}) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";

  const value = lowerRest ? raw.toLowerCase() : raw;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function normalizeNumber(value, { fallback = 0, integer = true, min = -Infinity, max = Infinity } = {}) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;

  const number = integer ? Math.trunc(raw) : raw;
  if (number < min || number > max) return fallback;

  return number;
}

export function normalizeKeepToken(keep) {
  if (keep === "+" || keep === "-") return keep;
  if (typeof keep !== "string") return null;

  const normalized = keep.toLowerCase();
  if (normalized === "kh" || normalized === "h" || normalized === "high") return "kh";
  if (normalized === "kl" || normalized === "l" || normalized === "low") return "kl";

  return null;
}

export function normalizeBoolean(value, { fallback = false } = {}) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return fallback;

  const normalized = normalizeText(value);
  if (["true", "on", "1", "yes"].includes(normalized)) return true;
  if (["false", "off", "0", "no"].includes(normalized)) return false;

  return fallback;
}
