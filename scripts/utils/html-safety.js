export function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

export function sanitizeDataAction(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_.:-]/g, "");
}

export function sanitizeClassList(value, { fallback = "" } = {}) {
  const classes = String(value ?? fallback)
    .split(/\s+/)
    .map(cls => cls.trim())
    .filter(cls => /^[a-zA-Z0-9_-]+$/.test(cls));

  if (!classes.length && fallback) return sanitizeClassList(fallback);
  return classes.join(" ");
}

export function sanitizeClassTokens(value, options = {}) {
  return sanitizeClassList(value, options).split(/\s+/).filter(Boolean);
}
