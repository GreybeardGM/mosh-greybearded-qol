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

function ensureContrast(color, reference = "#111", minRatio = 4.5) {
  const rgb = hexToRgb(color);
  const refRgb = hexToRgb(reference);
  if (!rgb || !refRgb) return color; // Ungültig → keine Änderung

  let ratio = contrastRatio(rgb, refRgb);
  let factor = 0.1;

  // Max 10 Aufhellungen (z. B. von #444 → #fff)
  while (ratio < minRatio && factor <= 1.0) {
    const brightened = brightenColor(rgb, factor);
    const newRatio = contrastRatio(brightened, refRgb);
    if (newRatio > ratio) {
      rgb.splice(0, 3, ...brightened);
      ratio = newRatio;
    }
    factor += 0.1;
  }

  return rgbToHex(rgb);
}

// Wandelt #rrggbb in [r, g, b]
function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// Wandelt RGB-Wert in Luminanz (gemäß WCAG)
function luminance([r, g, b]) {
  const norm = x => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * norm(r) + 0.7152 * norm(g) + 0.0722 * norm(b);
}

// Kontrastverhältnis zwischen zwei Farben (1.0 = kein Kontrast, 21 = max)
function contrastRatio(rgb1, rgb2) {
  const L1 = luminance(rgb1);
  const L2 = luminance(rgb2);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

// Hebt Helligkeit um Faktor (0–1)
function brightenColor(rgb, factor) {
  return rgb.map(c => Math.min(255, Math.round(c + (255 - c) * factor)));
}

// Wandelt [r,g,b] → "#rrggbb"
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");
}
