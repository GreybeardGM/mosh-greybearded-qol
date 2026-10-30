import { MODULE_ID, SETTING_CREDIT_HANDLER_CONFIG } from "../codex/constants.js";
import { normalizeBoolean } from "../utils/normalization.js";

export const CURRENCY_DIALOG_WIDTH = 480;
export const CREDIT_RECEIVE = "receive";
export const CREDIT_PAY = "pay";
export const CREDIT_TRANSFER = "transfer";
export const CREDIT_OPERATIONS = Object.freeze({
  [CREDIT_RECEIVE]: Object.freeze({ sign: 1, icon: "fa-circle-plus", labelKey: "MoshQoL.Currency.App.Receive" }),
  [CREDIT_PAY]: Object.freeze({ sign: -1, icon: "fa-circle-minus", labelKey: "MoshQoL.Currency.App.Pay" }),
  [CREDIT_TRANSFER]: Object.freeze({ sign: -1, icon: "fa-money-bill-transfer", labelKey: "MoshQoL.Currency.App.Transfer" })
});

// Explicit currency conventions, independent of each client's UI language.
export const CURRENCY_NOTATIONS = Object.freeze({
  en: { group: ",", decimal: ".", pattern: /^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]+)?$/, groups: /,/g, example: "1,234.5 kCR" },
  de: { group: ".", decimal: ",", pattern: /^(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+)(?:,[0-9]+)?$/, groups: /\./g, example: "1.234,5 kCR" },
  fr: { group: "\u202f", decimal: ",", pattern: /^(?:[0-9]+|[0-9]{1,3}(?:[ \u00a0\u202f][0-9]{3})+)(?:,[0-9]+)?$/, groups: /[ \u00a0\u202f]/g, example: "1\u202f234,5 kCR" },
  ch: { group: "\u2019", decimal: ".", pattern: /^(?:[0-9]+|[0-9]{1,3}(?:['\u2019][0-9]{3})+)(?:\.[0-9]+)?$/, groups: /['\u2019]/g, example: "1\u2019234.5 kCR" }
});

export function getDefaultCreditConfig() {
  return { enabled: true, notation: "en" };
}

export function getCreditConfig() {
  const config = globalThis.game?.settings?.get(MODULE_ID, SETTING_CREDIT_HANDLER_CONFIG);
  const defaults = getDefaultCreditConfig();
  return {
    enabled: normalizeBoolean(config?.enabled ?? defaults.enabled),
    // Unknown stored formats must fail validation rather than silently change notation.
    notation: config?.notation ?? defaults.notation
  };
}

export function isCreditHandlerEnabled() {
  return getCreditConfig().enabled;
}
