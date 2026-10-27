import { MOSH_CREDITS_PATH } from "../codex/mosh-system.js";
import { readCurrency } from "../utils/currency.js";
import { formatCurrency } from "../utils/currency-parser.js";
import { CREDIT_OPERATIONS, CREDIT_RECEIVE, CREDIT_STASH, getCreditConfig, isCreditHandlerEnabled } from "./config.js";
import { getCreditRecipientKind } from "./recipients.js";

// Shared by the Credits app and Pay Up: two local workflows must not spend
// the same snapshot while either validation or actor.update is pending.
const transactionsInFlight = new WeakSet();

export async function changeCredits(actor, input, { operation, recipient = null, allowNegativeAmount = false, canProceed = () => true } = {}) {
  if (!actor || !Object.hasOwn(CREDIT_OPERATIONS, operation) || !isCreditHandlerEnabled()
    || !canProceed()) return null;
  const isStash = operation === CREDIT_STASH;
  if (isStash && game.actors?.get(actor.id) !== actor) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.InvalidSource"));
    return null;
  }
  if (isStash && getCreditRecipientKind(actor, recipient) !== CREDIT_STASH) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.InvalidRecipient"));
    return null;
  }
  const participants = isStash ? [actor, recipient] : [actor];
  if (participants.some(document => transactionsInFlight.has(document))) return null;
  if (participants.some(document => !document.isOwner)) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.NoPermission"));
    return null;
  }
  const notation = getCreditConfig().notation;
  const snapshots = participants.map(document => ({
    document, original: foundry.utils.getProperty(document, MOSH_CREDITS_PATH)
  }));
  participants.forEach(document => transactionsInFlight.add(document));
  try {
    // Neither resolver saves repairs. Both values must succeed before any write;
    // cancellation is null, never zero or the manual sheet's retained raw text.
    const before = await readCurrency(snapshots[0].original, { label: actor.name });
    if (before === null || !canProceed()) return null;
    const parsedAmount = await readCurrency(input, { label: game.i18n.localize("MoshQoL.Currency.App.Amount") });
    if (parsedAmount === null || !canProceed()) return null;
    if (parsedAmount === 0 || (!allowNegativeAmount && parsedAmount < 0)) return null;
    if (operation === CREDIT_RECEIVE && parsedAmount < 0) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.SignConflict"));
      return null;
    }
    const amount = Math.abs(parsedAmount);
    snapshots[0].before = before;
    if (isStash) {
      snapshots[1].before = await readCurrency(snapshots[1].original, { label: recipient.name });
      if (snapshots[1].before === null || !canProceed()) return null;
    }
    if (CREDIT_OPERATIONS[operation].sign < 0 && before < amount) {
      ui.notifications.warn(game.i18n.format("MoshQoL.Currency.App.CannotAfford", { actorName: actor.name }));
      return null;
    }
    // Derived sums cannot be repaired by guessing or rounded by Number arithmetic.
    for (const [index, snapshot] of snapshots.entries()) {
      const sign = index === 0 ? CREDIT_OPERATIONS[operation].sign : 1;
      const afterExact = BigInt(snapshot.before) + BigInt(amount) * BigInt(sign);
      if (afterExact < BigInt(Number.MIN_SAFE_INTEGER) || afterExact > BigInt(Number.MAX_SAFE_INTEGER)) {
        ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Errors.integer_out_of_range"));
        return null;
      }
      snapshot.after = Number(afterExact);
      snapshot.formatted = formatCurrency(snapshot.after, { notation });
    }
    // Dialogs may outlive their app, permissions, configuration or balance.
    // Recheck immediately before dispatching the update; a closed app cannot book.
    if (!canProceed()) return null;
    if (!isCreditHandlerEnabled() || getCreditConfig().notation !== notation
      || snapshots.some(({ document, original }) => !document.isOwner || !Object.is(original, foundry.utils.getProperty(document, MOSH_CREDITS_PATH)))
      || (isStash && (game.actors?.get(actor.id) !== actor || getCreditRecipientKind(actor, recipient) !== CREDIT_STASH))) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Changed"));
      return null;
    }
    if (isStash) await saveStashTransfer(snapshots);
    else await actor.update({ [MOSH_CREDITS_PATH]: snapshots[0].formatted });
    return { before, amount, after: snapshots[0].after, notation,
      recipient: isStash ? recipient : null, recipientBefore: snapshots[1]?.before, recipientAfter: snapshots[1]?.after };
  } finally {
    participants.forEach(document => transactionsInFlight.delete(document));
  }
}

/** One batch after all validation; compensate a rejected or partially applied batch. */
async function saveStashTransfer(snapshots) {
  try {
    const updated = await Actor.implementation.updateDocuments(snapshots.map(({ document, formatted }) => ({
      _id: document.id, [MOSH_CREDITS_PATH]: formatted
    })));
    if (!snapshots.every(({ document, formatted }) => updated?.some(result => result.id === document.id)
      && Object.is(foundry.utils.getProperty(document, MOSH_CREDITS_PATH), formatted))) {
      throw new Error("Incomplete Stash credit update");
    }
  } catch (error) {
    // Foundry batches can be filtered by hooks. Restore balances still matching
    // this batch's exact output; never overwrite a different subsequent value.
    const applied = snapshots.filter(({ document, original, formatted }) => !Object.is(original, formatted)
      && Object.is(foundry.utils.getProperty(document, MOSH_CREDITS_PATH), formatted));
    if (applied.length) {
      try {
        await Actor.implementation.updateDocuments(applied.map(({ document, original }) => ({
          _id: document.id, [MOSH_CREDITS_PATH]: original
        })));
      } catch (rollbackError) {
        console.error("[MoSh QoL] Stash credit rollback failed", rollbackError);
      }
    }
    if (snapshots.some(({ document, original }) => !Object.is(foundry.utils.getProperty(document, MOSH_CREDITS_PATH), original))) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.CheckBalances"));
    }
    throw error;
  }
}
