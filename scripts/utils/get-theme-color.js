export function getThemeColor() {
  const global = game.settings.get("mosh-greybearded-qol", "themeColor")?.trim();
  if (isValidCssColor(global)) return global;

  const override = game.settings.get("mosh-greybearded-qol", "themeColorOverride")?.trim();
  if (isValidCssColor(override)) return override;

  const userHex = userColorToHex();
  if (isValidCssColor(userHex)) return userHex;

  return "#f50";
}

function userColorToHex() {
  const colorNum = game.user?.color;
  if (typeof colorNum === "number") {
    return "#" + colorNum.toString(16).padStart(6, "0");
  }
  return undefined;
}

function isValidCssColor(color) {
  const s = new Option().style;
  s.color = "";
  s.color = color;
  return !!s.color;
}
