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
  if (!rgb || !refRgb) {
    console.warn("❌ Invalid color inputs", { color, reference });
    return color;
  }

  let ratio = contrastRatio(rgb, refRgb);
  console.log("🔍 Initial contrast:", ratio);

  let factor = 0.1;
  while (ratio < minRatio && factor <= 1.0) {
    const brightened = brightenColor(rgb, factor);
    const newRatio = contrastRatio(brightened, refRgb);
    console.log(`→ Brighten +${Math.round(factor * 100)}% = contrast ${newRatio}`);
    if (newRatio > ratio) {
      rgb.splice(0, 3, ...brightened); // mutate
      ratio = newRatio;
    }
    factor += 0.1;
  }

  const result = rgbToHex(rgb);
  console.log("✅ Final color:", result);
  return result;
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
