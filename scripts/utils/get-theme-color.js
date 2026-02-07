const cssColorProbe = new Option().style;
let lastThemeInputs = null;
let lastThemeResult = "#f50";

export function getThemeColor() {
  const global = String(game.settings.get("mosh-greybearded-qol", "themeColor") || "").trim();
  const override = String(game.settings.get("mosh-greybearded-qol", "themeColorOverride") || "").trim();
  const userColor = game.user?.color;

  const cacheKey = `${global}|${override}|${String(userColor ?? "")}`;
  if (cacheKey === lastThemeInputs) return lastThemeResult;

  let result = "#f50";

  // 1. GM-Setting
  if (isValidCssColor(global)) {
    result = ensureContrast(global, "#111");
  }
  // 2. Spieler-Override
  else if (isValidCssColor(override)) {
    result = ensureContrast(override, "#111");
  }
  // 3. Spielerfarbe (Pixi-Zahl) in HEX umwandeln
  else {
    const colorNum = Number(userColor);
    if (!isNaN(colorNum)) {
      const hex = "#" + colorNum.toString(16).padStart(6, "0");
      if (isValidCssColor(hex)) result = ensureContrast(hex, "#111");
    }
  }

  lastThemeInputs = cacheKey;
  lastThemeResult = result;
  return result;
}

function isValidCssColor(color) {
  if (typeof color !== "string") return false;
  cssColorProbe.color = "";
  cssColorProbe.color = color;
  return cssColorProbe.color !== "";
}

function ensureContrast(color, reference = "#111", minRatio = 4.5) {
  const rgb = hexToRgb(color);
  const refRgb = hexToRgb(reference);
  if (!rgb || !refRgb) {
    return color;
  }

  let ratio = contrastRatio(rgb, refRgb);

  let factor = 0.1;
  while (ratio < minRatio && factor <= 1.0) {
    const brightened = brightenColor(rgb, factor);
    const newRatio = contrastRatio(brightened, refRgb);
    if (newRatio > ratio) {
      rgb.splice(0, 3, ...brightened); // mutate
      ratio = newRatio;
    }
    factor += 0.1;
  }

  return rgbToHex(rgb);
}

function hexToRgb(hex) {
  // Erweitert auch kurze HEX wie "#111" zu "#111111"
  hex = hex.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map(c => c + c).join("");
  }

  if (hex.length !== 6) return null;

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return [r, g, b];
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
