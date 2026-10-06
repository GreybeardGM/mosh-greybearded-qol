import { classifyCurrency, formatCurrency } from "./currency-parser.js";

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
  const display = input.closest(".currency-field")?.querySelector("[data-currency-display]");
  if (display) {
    display.textContent = parsed.status === "success" ? formatCurrency(parsed.value) : input.value;
    display.style.display = "flex";
  }

  input.style.visibility = "hidden";
}

function showCurrencyInput(input) {
  const display = input.closest(".currency-field")?.querySelector("[data-currency-display]");
  if (display) display.style.display = "none";

  input.style.visibility = "visible";
}

export function attachCurrencyFieldHandlers(html) {
  html.find("[data-currency-display]").on("click", function () {
    const input = this.closest(".currency-field")?.querySelector(".currency-input");
    if (!input) return;

    showCurrencyInput(input);
    input.focus();
    input.select();
  });

  html.find(".currency-input")
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
