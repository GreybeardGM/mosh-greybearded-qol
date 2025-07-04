export function getThemeColor() {
  const override = game.settings.get("mosh-greybearded-qol", "themeColorOverride")?.trim();
  if (isValidCssColor(override)) return override;
  
  const global = game.settings.get("mosh-greybearded-qol", "themeColor")?.trim();
  if (isValidCssColor(global)) return global;
  
  return "#f50";
}

function isValidCssColor(color) {
  const s = new Option().style;
  s.color = "";
  s.color = color;
  return !!s.color;
}
