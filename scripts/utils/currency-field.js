import { classifyCurrency, formatCurrency } from "./currency-parser.js";

const FIELD_SELECTOR = ".currency-field";
const INPUT_SELECTOR = ".currency-input";
const DISPLAY_SELECTOR = "[data-currency-display]";

/** A completed save is the new baseline, including intentionally invalid text. */
export function syncCurrencyFieldBaseline(sheet, formData, path) {
  if (!(path in formData)) return; // Unrelated saves must not legitimize a stale input.
  const input = sheet.form?.elements.namedItem(path);
  if (input) input.defaultValue = String(formData[path] ?? "");
}

function showCurrencyDisplay(input) {
  // Display is read-only: actual input resolution belongs to the awaited form
  // save. Never overwrite text merely by rendering, focusing, or blurring it.
  const parsed = classifyCurrency(input.value);
  const display = input.closest(FIELD_SELECTOR)?.querySelector(DISPLAY_SELECTOR);
  if (display) {
    display.textContent = parsed.status === "success" ? formatCurrency(parsed.value) : input.value;
    display.style.display = "flex";
  }

  input.style.visibility = "hidden";
}

function showCurrencyInput(input) {
  const display = input.closest(FIELD_SELECTOR)?.querySelector(DISPLAY_SELECTOR);
  if (display) display.style.display = "none";

  input.style.visibility = "visible";
}

export function attachCurrencyFieldHandlers(html) {
  html.find(DISPLAY_SELECTOR).on("click", function () {
    const input = this.closest(FIELD_SELECTOR)?.querySelector(INPUT_SELECTOR);
    if (!input) return;

    showCurrencyInput(input);
    input.focus();
    input.select();
  });

  html.find(INPUT_SELECTOR)
    .on("focus", function () {
      showCurrencyInput(this);
    })
    .on("blur", function () {
      showCurrencyDisplay(this);
    })
    .each(function () {
      showCurrencyDisplay(this);
    });
}
