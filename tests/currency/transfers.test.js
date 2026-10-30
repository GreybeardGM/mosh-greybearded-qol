import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, contexts, warnings, batchWrites, state, BaseSheet } from "../helpers/foundry-environment.js";
import { bookCredits, creditApp, transferApp as createTransferFixture } from "../currency/app-fixture.js";

const { classifyCurrency } = await import("../../scripts/utils/currency-parser.js");
const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { payShoreLeave } = await import("../../scripts/chat-actions.js");
const { CreditsApp } = await import("../../scripts/currency/credits-app.js");

test.beforeEach(resetFoundryEnvironment);

for (const recipientKind of ["Stash", "player character"]) {
  const transferApp = (balance, recipientBalance, input) => createTransferFixture(balance, recipientBalance, input, {
    stash: recipientKind === "Stash"
  });

  test(`${recipientKind}: the Transfer button books to the selected owned recipient`, async () => {
    const { app, target, recipient, receipts } = transferApp();
    await CreditsApp.DEFAULT_OPTIONS.actions.transfer.call(app, null, { dataset: { action: "transfer" } });
    assert.equal(classifyCurrency(target.system.credits.value).value, 7000);
    assert.equal(classifyCurrency(recipient.system.credits.value).value, 3000);
    assert.equal(batchWrites.length, 1);
    assert.equal(receipts.length, 1);
  });

  test(`${recipientKind}: transfer validates all three inputs and saves a value-preserving two-actor batch in all notations`, async () => {
    for (const notation of ["en", "de", "fr", "ch"]) {
      game.actors.contents = [];
      state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation };
      const { app, target, recipient, receipts } = transferApp();
      await bookCredits(app, "transfer");
      assert.equal(classifyCurrency(target.system.credits.value).value, 7000);
      assert.equal(classifyCurrency(recipient.system.credits.value).value, 3000);
      assert.equal(target.writes.length, 1);
      assert.equal(recipient.writes.length, 1);
      assert.equal(batchWrites.at(-1).length, 2);
      assert.equal(app.closed, true);
      assert.equal(receipts.length, 1);
      assert.equal(contexts.at(-1).blocks[3].text, recipient.name);
      assert.equal(classifyCurrency(contexts.at(-1).blocks.at(-1).value).value, 3000);
    }
    assert.equal(dialogs.length, 0);
  });

  test(`${recipientKind}: cancelling any transfer correction leaves both original balances untouched, including repaired earlier inputs`, async () => {
    for (const cancel of ["cancel", null, undefined]) {
      for (const [balance, recipientBalance, input, replies] of [
        ["8k", "bad", "1k", [cancel]],
        ["bad", "2k", "1k", [cancel]],
        ["8k", "2k", "bad", [cancel]],
        ["bad source", "bad recipient", "bad amount", [{ input: "8k" }, { input: "1k" }, cancel]],
        ["8k", "bad recipient", "1k", [{ input: "still bad" }, cancel]]
      ]) {
        game.actors.contents = [];
        const { app, target, recipient, receipts, transferSelect, buttons } = transferApp(balance, recipientBalance, input);
        buttons[0].disabled = true;
        state.responses = replies;
        await bookCredits(app, "transfer");
        assert.equal(target.system.credits.value, balance);
        assert.equal(recipient.system.credits.value, recipientBalance);
        assert.deepEqual(target.writes, []);
        assert.deepEqual(recipient.writes, []);
        assert.equal(batchWrites.length, 0);
        assert.equal(receipts.length, 0);
        assert.equal(transferSelect.disabled, false);
        assert.equal(buttons[0].disabled, true);
        assert.equal(state.responses.length, 0);
      }
    }
  });

  test(`${recipientKind}: transfer repairs are only persisted as the final calculated balances`, async () => {
    const { app, target, recipient } = transferApp("bad source", "bad recipient", "bad amount");
    state.responses = [{ input: "8k" }, { input: "1k" }, { input: "still bad" }, { input: "2k" }];
    await bookCredits(app, "transfer");
    assert.equal(target.system.credits.value, "7.0 kcr");
    assert.equal(recipient.system.credits.value, "3.0 kcr");
    assert.equal(batchWrites.length, 1);
    assert.equal(target.writes.length, 1);
    assert.equal(recipient.writes.length, 1);
  });

  test(`${recipientKind}: missing, self, foreign, ineligible and synthetic-token actors cannot initiate a transfer`, async () => {
    for (const scenario of ["missing", "self", "not owned", "NPC", "creature", "token"]) {
      game.actors.contents = [];
      const { app, target, recipient, transferSelect, receipts } = transferApp();
      if (scenario === "missing") transferSelect.value = "deleted";
      if (scenario === "self") transferSelect.value = target.id;
      if (scenario === "not owned") recipient.isOwner = false;
      if (scenario === "NPC") { recipient.sheet = new BaseSheet(recipient); recipient.hasPlayerOwner = false; }
      if (scenario === "creature") recipient.type = "creature";
      if (scenario === "token") app.actor = { ...target, uuid: "Scene.X.Token.Y.Actor.source", isToken: true };
      await bookCredits(app, "transfer");
      assert.deepEqual(target.writes, []);
      assert.deepEqual(recipient.writes, []);
      assert.equal(batchWrites.length, 0);
      assert.equal(receipts.length, 0);
    }
  });

  test(`${recipientKind}: any stale participant, role, ownership, notation or cancelled app aborts a pending transfer repair`, async () => {
    for (const change of [
      fixture => { fixture.target.system.credits.value = "9k"; },
      fixture => { fixture.recipient.system.credits.value = "3k"; },
      fixture => { fixture.recipient.isOwner = false; },
      fixture => { fixture.target.isOwner = false; },
      fixture => { fixture.recipient.sheet = new BaseSheet(fixture.recipient); fixture.recipient.hasPlayerOwner = false; },
      fixture => { game.actors.contents = game.actors.contents.filter(actor => actor !== fixture.recipient); },
      fixture => { game.actors.contents = game.actors.contents.filter(actor => actor !== fixture.target); },
      () => { state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" }; },
      () => { state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation: "de" }; },
      fixture => fixture.app.close()
    ]) {
      game.actors.contents = []; state.settings = {};
      const fixture = transferApp("8k", "bad recipient");
      state.responses = [async () => { await change(fixture); return { input: "2k" }; }];
      await bookCredits(fixture.app, "transfer");
      assert.deepEqual(fixture.target.writes, []);
      assert.deepEqual(fixture.recipient.writes, []);
      assert.equal(batchWrites.length, 0);
      assert.equal(fixture.receipts.length, 0);
    }
  });

  test(`${recipientKind}: transfer refuses insufficient funds, zero amounts and destination overflow without changing either actor`, async () => {
    for (const [balance, recipientBalance, input] of [["1k", "2k", "2k"], ["8k", "2k", "0"], ["8k", Number.MAX_SAFE_INTEGER, "1"]]) {
      game.actors.contents = [];
      const { app, target, recipient, receipts } = transferApp(balance, recipientBalance, input);
      await bookCredits(app, "transfer");
      assert.deepEqual(target.writes, []);
      assert.deepEqual(recipient.writes, []);
      assert.equal(batchWrites.length, 0);
      assert.equal(receipts.length, 0);
    }
  });

  test(`${recipientKind}: transfer holds both actor locks during a correction and releases them after cancellation`, async () => {
    const { app, target, recipient } = transferApp("8k", "bad recipient");
    let release, started;
    const entered = new Promise(resolve => { started = resolve; });
    state.responses = [() => { started(); return new Promise(resolve => { release = resolve; }); }];
    const pending = bookCredits(app, "transfer");
    await entered;
    await payShoreLeave(target, 100);
    await payShoreLeave(recipient, 100);
    assert.equal(target.writes.length, 0);
    assert.equal(recipient.writes.length, 0);
    release("cancel"); await pending;
    await payShoreLeave(target, 100);
    assert.equal(classifyCurrency(target.system.credits.value).value, 7900);
  });

  test(`${recipientKind}: a filtered partial transfer batch is compensated without a success receipt and can be retried`, async () => {
    const { app, target, recipient, receipts } = transferApp();
    const update = Actor.implementation.updateDocuments, originalError = console.error;
    let first = true;
    Actor.implementation.updateDocuments = async updates => {
      if (first) { first = false; return update(updates.slice(0, 1)); }
      return update(updates);
    };
    console.error = () => {};
    try { await bookCredits(app, "transfer"); } finally { console.error = originalError; }
    assert.equal(target.system.credits.value, "8k");
    assert.equal(recipient.system.credits.value, "2k");
    assert.equal(receipts.length, 0);
    assert.equal(app.closed, undefined);
    await bookCredits(app, "transfer");
    assert.equal(classifyCurrency(target.system.credits.value).value, 7000);
    assert.equal(classifyCurrency(recipient.system.credits.value).value, 3000);
    assert.equal(receipts.length, 1);
  });

  test(`${recipientKind}: a rejected transfer batch before saving leaves both actors untouched`, async () => {
    const { app, target, recipient, receipts } = transferApp();
    const originalError = console.error;
    Actor.implementation.updateDocuments = async () => { throw new Error("batch rejected"); };
    console.error = () => {};
    try { await bookCredits(app, "transfer"); } finally { console.error = originalError; }
    assert.equal(target.system.credits.value, "8k");
    assert.equal(recipient.system.credits.value, "2k");
    assert.equal(target.writes.length, 0);
    assert.equal(recipient.writes.length, 0);
    assert.equal(receipts.length, 0);
  });

  test(`${recipientKind}: both actor locks remain held until the transfer batch has finished saving`, async () => {
    const { app, target, recipient } = transferApp();
    const update = Actor.implementation.updateDocuments;
    let release, started;
    const entered = new Promise(resolve => { started = resolve; });
    const pending = new Promise(resolve => { release = resolve; });
    Actor.implementation.updateDocuments = async updates => { started(); await pending; return update(updates); };
    const first = bookCredits(app, "transfer");
    await entered;
    await payShoreLeave(target, 100);
    await payShoreLeave(recipient, 100);
    await bookCredits(app, "transfer");
    assert.equal(target.writes.length, 0);
    assert.equal(recipient.writes.length, 0);
    release(); await first;
    assert.equal(target.writes.length, 1);
    assert.equal(recipient.writes.length, 1);
  });

  test(`${recipientKind}: transfer rollback preserves a subsequent edit and reports the need to check balances`, async () => {
    const { app, target, recipient, receipts } = transferApp();
    const update = Actor.implementation.updateDocuments, originalError = console.error;
    Actor.implementation.updateDocuments = async updates => {
      await update(updates.slice(0, 1));
      target.system.credits.value = "9k";
      return [target];
    };
    console.error = () => {};
    try { await bookCredits(app, "transfer"); } finally { console.error = originalError; }
    assert.equal(target.system.credits.value, "9k");
    assert.equal(recipient.system.credits.value, "2k");
    assert.equal(batchWrites.length, 1);
    assert.ok(warnings.includes("MoshQoL.Currency.App.CheckBalances"));
    assert.equal(receipts.length, 0);
  });

  test(`${recipientKind}: failed transfer compensation warns explicitly and never posts a success receipt`, async () => {
    const { app, target, recipient, receipts } = transferApp();
    const update = Actor.implementation.updateDocuments, originalError = console.error;
    let first = true;
    Actor.implementation.updateDocuments = async updates => {
      if (first) { first = false; return update(updates.slice(0, 1)); }
      throw new Error("rollback rejected");
    };
    console.error = () => {};
    try { await bookCredits(app, "transfer"); } finally { console.error = originalError; }
    assert.equal(target.system.credits.value, "7.0 kcr");
    assert.equal(recipient.system.credits.value, "2k");
    assert.ok(warnings.includes("MoshQoL.Currency.App.CheckBalances"));
    assert.equal(receipts.length, 0);
  });
}

test("owned Stashes can transfer to player characters or other Stashes through the same action", async () => {
  for (const stash of [false, true]) {
    game.actors.contents = [];
    const { app, target, recipient, receipts } = createTransferFixture("8k", "2k", "1k", { sourceStash: true, stash });
    await bookCredits(app, "transfer");
    assert.equal(classifyCurrency(target.system.credits.value).value, 7000);
    assert.equal(classifyCurrency(recipient.system.credits.value).value, 3000);
    assert.equal(receipts.length, 1);
  }
});

test("a reverse transfer is blocked while either Actor is awaiting correction", async () => {
  const { app, target, recipient } = createTransferFixture("8k", "bad", "1k", { stash: false });
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  state.responses = [() => { started(); return new Promise(resolve => { release = resolve; }); }];
  const pending = bookCredits(app, "transfer");
  await entered;
  const reverse = creditApp("bad", "1k", { target: recipient });
  reverse.transferSelect.value = target.id;
  await bookCredits(reverse.app, "transfer");
  assert.deepEqual(target.writes, []);
  assert.deepEqual(recipient.writes, []);
  assert.equal(batchWrites.length, 0);
  release("cancel");
  await pending;
  assert.deepEqual(target.writes, []);
  assert.deepEqual(recipient.writes, []);
  assert.equal(batchWrites.length, 0);
});
