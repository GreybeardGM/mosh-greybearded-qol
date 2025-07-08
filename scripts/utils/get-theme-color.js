export function getThemeColor() {
  // 1. Weltweites GM-Setting
  const global = String(game.settings.get("mosh-greybearded-qol", "themeColor") || "").trim();
  if (isValidCssColor(global)) return global;

  // 2. Spieler-spezifisches Override
  const override = String(game.settings.get("mosh-greybearded-qol", "themeColorOverride") || "").trim();
  if (isValidCssColor(override)) return override;

  // 3. Spielerfarbe (als Zahl) -> umwandeln in HEX
  const userColor = game.user?.color;
    console.log(userColor);
  if (typeof userColor === "number") {
    const hex = "#" + userColor.toString(16).padStart(6, "0");
    console.log(hex);
    if (isValidCssColor(hex)) return hex;
  }

  // 4. Harte Fallback-Farbe
  return "#f50";
}

function isValidCssColor(color) {
  if (typeof color !== "string") return false;
  const s = new Option().style;
  s.color = "";
  s.color = color;
  return s.color !== "";
}
