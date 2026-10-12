import { MOSH_CREDITS_PATH } from "../codex/mosh-system.js";
import { readCurrency } from "../utils/currency.js";
import { formatCurrency } from "../utils/currency-parser.js";
import { CREDIT_OPERATIONS, CREDIT_PAY, CREDIT_RECEIVE, getCreditConfig, isCreditHandlerEnabled } from "./config.js";

// Shared by the Credits app and Pay Up: two local workflows must not spend
// the same snapshot while either validation or actor.update is pending.
const transactionsInFlight = new WeakSet();

export async function changeCredits(actor, input, { operation, allowNegativeAmount = false, canProceed = () => true } = {}) {
  if (!actor || !Object.hasOwn(CREDIT_OPERATIONS, operation) || !isCreditHandlerEnabled()
    || transactionsInFlight.has(actor) || !canProceed()) return null;
  if (!actor.isOwner) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.NoPermission"));
    return null;
  }
  const notation = getCreditConfig().notation;
  const original = foundry.utils.getProperty(actor, MOSH_CREDITS_PATH);
  transactionsInFlight.add(actor);
  try {
    // Neither resolver saves repairs. Both values must succeed before any write;
    // cancellation is null, never zero or the manual sheet's retained raw text.
    const before = await readCurrency(original, { label: actor.name });
    if (before === null || !canProceed()) return null;
    const parsedAmount = await readCurrency(input, { label: game.i18n.localize("MoshQoL.Currency.App.Amount") });
    if (parsedAmount === null || !canProceed()) return null;
    if (parsedAmount === 0 || (!allowNegativeAmount && parsedAmount < 0)) return null;
    if (operation === CREDIT_RECEIVE && parsedAmount < 0) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.SignConflict"));
      return null;
    }
    const amount = Math.abs(parsedAmount);
    if (operation === CREDIT_PAY && before < amount) {
      ui.notifications.warn(game.i18n.format("MoshQoL.Currency.App.CannotAfford", { actorName: actor.name }));
      return null;
    }
    // Derived sums cannot be repaired by guessing or rounded by Number arithmetic.
    const afterExact = BigInt(before) + BigInt(amount) * BigInt(CREDIT_OPERATIONS[operation].sign);
    if (afterExact < BigInt(Number.MIN_SAFE_INTEGER) || afterExact > BigInt(Number.MAX_SAFE_INTEGER)) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Errors.integer_out_of_range"));
      return null;
    }
    // Dialogs may outlive their app, permissions, configuration or balance.
    // Recheck immediately before dispatching the update; a closed app cannot book.
    if (!canProceed()) return null;
    if (!actor.isOwner || !isCreditHandlerEnabled() || getCreditConfig().notation !== notation
      || !Object.is(original, foundry.utils.getProperty(actor, MOSH_CREDITS_PATH))) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Changed"));
      return null;
    }
    const after = Number(afterExact);
    await actor.update({ [MOSH_CREDITS_PATH]: formatCurrency(after, { notation }) });
    return { before, amount, after, notation };
  } finally {
    transactionsInFlight.delete(actor);
  }
}
