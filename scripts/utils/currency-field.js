import { formatCurrency, parseCurrencyValue } from "./normalization.js";

function showCurrencyDisplay(input) {
  const raw = parseCurrencyValue(input.value);
  input.value = String(raw);

  const display = input.closest(".currency-field")?.querySelector("[data-currency-display]");
  if (display) {
    display.textContent = formatCurrency(raw);
    //display.style.display = "flex";
  }

  input.style.visibility = "hidden";
}

function showCurrencyInput(input) {
  const raw = parseCurrencyValue(input.value);
  input.value = String(raw);

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
