export function getThemeColor() {
  // 1. GM-Setting
  const global = String(game.settings.get("mosh-greybearded-qol", "themeColor") || "").trim();
  if (isValidCssColor(global)) return ensureContrast(global, "#111");

  // 2. Spieler-Override
  const override = String(game.settings.get("mosh-greybearded-qol", "themeColorOverride") || "").trim();
  if (isValidCssColor(override)) return ensureContrast(override, "#111");
  
  // 3. Spielerfarbe (Pixi-Zahl) in HEX umwandeln
  const userColor = game.user?.color;
  const colorNum = Number(userColor);
  console.log("userColor (raw):", userColor);
  if (!isNaN(colorNum)) {
    const hex = "#" + colorNum.toString(16).padStart(6, "0");
    console.log("hex from userColor:", hex);
    if (isValidCssColor(hex)) return ensureContrast(hex, "#111");
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

export function ensureContrast(color, reference = "#111", minRatio = 4.5) {
  const rgb = hexToRgb(color);
  const refRgb = hexToRgb(reference);
  if (!rgb || !refRgb) return color;

  let ratio = contrastRatio(rgb, refRgb);
  let factor = 0.1;

  while (ratio < minRatio && factor <= 1.0) {
    const brightened = brightenColor(rgb, factor);
    const newRatio = contrastRatio(brightened, refRgb);
    if (newRatio > ratio) {
      rgb.splice(0, 3, ...brightened); // overwrite original
      ratio = newRatio;
    }
    factor += 0.1;
  }

  return rgbToHex(rgb);
}

function hexToRgb(hex) {
  const m = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

function luminance([r, g, b]) {
  const c = [r, g, b].map(v => {
    const f = v / 255;
    return f <= 0.03928 ? f / 12.92 : Math.pow((f + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastRatio(rgb1, rgb2) {
  const L1 = luminance(rgb1);
  const L2 = luminance(rgb2);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

function brightenColor([r, g, b], factor) {
  return [
    Math.min(255, Math.round(r + (255 - r) * factor)),
    Math.min(255, Math.round(g + (255 - g) * factor)),
    Math.min(255, Math.round(b + (255 - b) * factor)),
  ];
}
