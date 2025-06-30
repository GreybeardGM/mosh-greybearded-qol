
export function getThemeColor() {
  const theme = game.settings.get("mosh-greybearded-qol", "themeColor") || "orange";
  return `theme-${theme}`;
}
