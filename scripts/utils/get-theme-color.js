
export function getThemeColor() {
  const override = game.settings.get("mosh-greybearded-qol", "themeColorOverride");
  const global = game.settings.get("mosh-greybearded-qol", "themeColor");
  const theme = override || global || "orange";
  return `theme-${theme}`;
}
