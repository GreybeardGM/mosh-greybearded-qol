export function getThemeColor() {
  // 1. GM-Setting
  const global = String(game.settings.get("mosh-greybearded-qol", "themeColor") || "").trim();
  if (isValidCssColor(global)) return global;

  // 2. Spieler-Override
  const override = String(game.settings.get("mosh-greybearded-qol", "themeColorOverride") || "").trim();
  if (isValidCssColor(override)) return override;

  // 3. Spielerfarbe (Pixi-Zahl) in HEX umwandeln
  const userColor = game.user?.color;
  const colorNum = Number(userColor);
  console.log("userColor (raw):", userColor);
  if (!isNaN(colorNum)) {
    const hex = "#" + colorNum.toString(16).padStart(6, "0");
    console.log("hex from userColor:", hex);
    if (isValidCssColor(hex)) return hex;
  }

  // 4. Fallback
  return "#f50";
}

function isValidCssColor(color) {
  if (typeof color !== "string") return false;
  const s = new Option().style;
  s.color = "";
  s.color = color;
  return s.color !== "";
}
