export const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

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

export function parseCurrencyValue(value, { fallback = 0 } = {}) {
  const numericValue = typeof value === "number"
    ? Math.trunc(value)
    : Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function formatCurrency(value, { locale = game?.i18n?.lang } = {}) {
  const numericValue = parseCurrencyValue(value);

  const absoluteValue = Math.abs(numericValue);
  const sign = numericValue < 0 ? "-" : "";
  const scaledFormatOptions = {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: true
  };

  if (absoluteValue !== 0 && absoluteValue % 100000000 === 0) {
    const scaled = absoluteValue / 1000000000;
    return `${sign}${scaled.toLocaleString(locale, scaledFormatOptions)} Gcr`;
  }

  if (absoluteValue !== 0 && absoluteValue % 100000 === 0) {
    const scaled = absoluteValue / 1000000;
    return `${sign}${scaled.toLocaleString(locale, scaledFormatOptions)} Mcr`;
  }

  if (absoluteValue !== 0 && absoluteValue % 100 === 0) {
    const scaled = absoluteValue / 1000;
    return `${sign}${scaled.toLocaleString(locale, scaledFormatOptions)} kcr`;
  }

  return `${sign}${absoluteValue.toLocaleString(locale, { useGrouping: true })} cr`;
}
