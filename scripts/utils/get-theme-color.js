import { DEFAULT_THEME_COLOR, MODULE_ID, SETTING_THEME_COLOR, SETTING_THEME_COLOR_OVERRIDE } from "../codex/constants.js";

const cssColorProbe = new Option().style;

export function getThemeColor() {
  const global = String(game.settings.get(MODULE_ID, SETTING_THEME_COLOR) || "").trim();
  const override = String(game.settings.get(MODULE_ID, SETTING_THEME_COLOR_OVERRIDE) || "").trim();
  const userColor = Number(game.user?.color);
  const userHex = Number.isNaN(userColor) ? "" : `#${userColor.toString(16).padStart(6, "0")}`;

  for (const color of [global, override, userHex]) {
    if (isValidCssColor(color)) return ensureContrast(color, "#111");
  }

  return DEFAULT_THEME_COLOR;
}

function isValidCssColor(color) {
  if (typeof color !== "string") return false;
  cssColorProbe.color = "";
  cssColorProbe.color = color;
  return cssColorProbe.color !== "";
}

function ensureContrast(color, reference = "#111", minRatio = 4.5) {
  let rgb = hexToRgb(color);
  const refRgb = hexToRgb(reference);
  if (!rgb || !refRgb) return color;

  for (let factor = 0.1; contrastRatio(rgb, refRgb) < minRatio && factor <= 1.0; factor += 0.1) {
    rgb = brightenColor(rgb, factor);
  }

  return rgbToHex(rgb);
}

function hexToRgb(hex) {
  hex = hex.trim().replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  if (hex.length !== 6) return null;

  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map(x => x.toString(16).padStart(2, "0")).join("")}`;
}

function luminance([r, g, b]) {
  const [red, green, blue] = [r, g, b].map((v) => {
    const f = v / 255;
    return f <= 0.03928 ? f / 12.92 : Math.pow((f + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(rgb1, rgb2) {
  const L1 = luminance(rgb1);
  const L2 = luminance(rgb2);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

function brightenColor([r, g, b], factor) {
  return [r, g, b].map((channel) => Math.min(255, Math.round(channel + (255 - channel) * factor)));
}
