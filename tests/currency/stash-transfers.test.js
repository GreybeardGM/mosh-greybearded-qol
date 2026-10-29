import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, contexts, warnings, batchWrites, state, BaseSheet } from "../helpers/foundry-environment.js";
import { bookCredits, stashApp } from "../currency/app-fixture.js";

const { classifyCurrency } = await import("../../scripts/utils/currency-parser.js");
const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { payShoreLeave } = await import("../../scripts/chat-actions.js");
const { CreditsApp } = await import("../../scripts/currency/credits-app.js");

test.beforeEach(resetFoundryEnvironment);

test("Transfer is a no-op even when a player character and an invalid amount are selected", async () => {
  const { app, target, stash, receipts, transferSelect } = stashApp("bad", "bad", "bad");
  transferSelect.value = stash.id;
  await CreditsApp.DEFAULT_OPTIONS.actions.transfer.call(app);
  await bookCredits(app, "transfer");
  assert.deepEqual(target.writes, []);
  assert.deepEqual(stash.writes, []);
  assert.equal(batchWrites.length, 0);
  assert.equal(receipts.length, 0);
  assert.equal(dialogs.length, 0);
});

test("Stash validates all three inputs and saves a value-preserving two-actor batch in all notations", async () => {
  for (const notation of ["en", "de", "fr", "ch"]) {
    game.actors.contents = [];
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation };
    const { app, target, stash, receipts } = stashApp();
    await bookCredits(app, "stash");
    assert.equal(classifyCurrency(target.system.credits.value).value, 7000);
    assert.equal(classifyCurrency(stash.system.credits.value).value, 3000);
    assert.equal(target.writes.length, 1);
    assert.equal(stash.writes.length, 1);
    assert.equal(batchWrites.at(-1).length, 2);
    assert.equal(app.closed, true);
    assert.equal(receipts.length, 1);
    assert.equal(contexts.at(-1).blocks[3].text, stash.name);
    assert.equal(classifyCurrency(contexts.at(-1).blocks.at(-1).value).value, 3000);
  }
  assert.equal(dialogs.length, 0);
});

test("cancelling any Stash correction leaves both original balances untouched, including repaired earlier inputs", async () => {
  for (const cancel of ["cancel", null, undefined]) {
    for (const [balance, stashBalance, input, replies] of [
      ["8k", "bad", "1k", [cancel]],
      ["bad", "2k", "1k", [cancel]],
      ["8k", "2k", "bad", [cancel]],
      ["bad source", "bad stash", "bad amount", [{ input: "8k" }, { input: "1k" }, cancel]],
      ["8k", "bad stash", "1k", [{ input: "still bad" }, cancel]]
    ]) {
      game.actors.contents = [];
      const { app, target, stash, receipts, stashSelect, transferSelect } = stashApp(balance, stashBalance, input);
      transferSelect.disabled = true;
      state.responses = replies;
      await bookCredits(app, "stash");
      assert.equal(target.system.credits.value, balance);
      assert.equal(stash.system.credits.value, stashBalance);
      assert.deepEqual(target.writes, []);
      assert.deepEqual(stash.writes, []);
      assert.equal(batchWrites.length, 0);
      assert.equal(receipts.length, 0);
      assert.equal(stashSelect.disabled, false);
      assert.equal(transferSelect.disabled, true);
      assert.equal(state.responses.length, 0);
    }
  }
});

test("Stash repairs are only persisted as the final calculated balances", async () => {
  const { app, target, stash } = stashApp("bad source", "bad stash", "bad amount");
  state.responses = [{ input: "8k" }, { input: "1k" }, { input: "still bad" }, { input: "2k" }];
  await bookCredits(app, "stash");
  assert.equal(target.system.credits.value, "7.0 kcr");
  assert.equal(stash.system.credits.value, "3.0 kcr");
  assert.equal(batchWrites.length, 1);
  assert.equal(target.writes.length, 1);
  assert.equal(stash.writes.length, 1);
});

test("missing, self, foreign, non-Stash and synthetic-token sources cannot initiate a Stash batch", async () => {
  for (const scenario of ["missing", "self", "not owned", "player", "token"]) {
    game.actors.contents = [];
    const { app, target, stash, stashSelect, receipts } = stashApp();
    if (scenario === "missing") stashSelect.value = "deleted";
    if (scenario === "self") stashSelect.value = target.id;
    if (scenario === "not owned") stash.isOwner = false;
    if (scenario === "player") stash.sheet = new BaseSheet(stash);
    if (scenario === "token") app.actor = { ...target, uuid: "Scene.X.Token.Y.Actor.source", isToken: true };
    await bookCredits(app, "stash");
    assert.deepEqual(target.writes, []);
    assert.deepEqual(stash.writes, []);
    assert.equal(batchWrites.length, 0);
    assert.equal(receipts.length, 0);
  }
});

test("any stale participant, role, ownership, notation or cancelled app aborts a pending Stash repair", async () => {
  for (const change of [
    fixture => { fixture.target.system.credits.value = "9k"; },
    fixture => { fixture.stash.system.credits.value = "3k"; },
    fixture => { fixture.stash.isOwner = false; },
    fixture => { fixture.target.isOwner = false; },
    fixture => { fixture.stash.sheet = new BaseSheet(fixture.stash); },
    fixture => { game.actors.contents = game.actors.contents.filter(actor => actor !== fixture.stash); },
    fixture => { game.actors.contents = game.actors.contents.filter(actor => actor !== fixture.target); },
    () => { state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" }; },
    () => { state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation: "de" }; },
    fixture => fixture.app.close()
  ]) {
    game.actors.contents = []; state.settings = {};
    const fixture = stashApp("8k", "bad stash");
    state.responses = [async () => { await change(fixture); return { input: "2k" }; }];
    await bookCredits(fixture.app, "stash");
    assert.deepEqual(fixture.target.writes, []);
    assert.deepEqual(fixture.stash.writes, []);
    assert.equal(batchWrites.length, 0);
    assert.equal(fixture.receipts.length, 0);
  }
});

test("Stash refuses insufficient funds, zero amounts and destination overflow without changing either actor", async () => {
  for (const [balance, stashBalance, input] of [["1k", "2k", "2k"], ["8k", "2k", "0"], ["8k", Number.MAX_SAFE_INTEGER, "1"]]) {
    game.actors.contents = [];
    const { app, target, stash, receipts } = stashApp(balance, stashBalance, input);
    await bookCredits(app, "stash");
    assert.deepEqual(target.writes, []);
    assert.deepEqual(stash.writes, []);
    assert.equal(batchWrites.length, 0);
    assert.equal(receipts.length, 0);
  }
});

test("Stash holds both actor locks during a correction and releases them after cancellation", async () => {
  const { app, target, stash } = stashApp("8k", "bad stash");
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  state.responses = [() => { started(); return new Promise(resolve => { release = resolve; }); }];
  const pending = bookCredits(app, "stash");
  await entered;
  await payShoreLeave(target, 100);
  await payShoreLeave(stash, 100);
  assert.equal(target.writes.length, 0);
  assert.equal(stash.writes.length, 0);
  release("cancel"); await pending;
  await payShoreLeave(target, 100);
  assert.equal(classifyCurrency(target.system.credits.value).value, 7900);
});

test("a filtered partial Stash batch is compensated without a success receipt and can be retried", async () => {
  const { app, target, stash, receipts } = stashApp();
  const update = Actor.implementation.updateDocuments, originalError = console.error;
  let first = true;
  Actor.implementation.updateDocuments = async updates => {
    if (first) { first = false; return update(updates.slice(0, 1)); }
    return update(updates);
  };
  console.error = () => {};
  try { await bookCredits(app, "stash"); } finally { console.error = originalError; }
  assert.equal(target.system.credits.value, "8k");
  assert.equal(stash.system.credits.value, "2k");
  assert.equal(receipts.length, 0);
  assert.equal(app.closed, undefined);
  await bookCredits(app, "stash");
  assert.equal(classifyCurrency(target.system.credits.value).value, 7000);
  assert.equal(classifyCurrency(stash.system.credits.value).value, 3000);
  assert.equal(receipts.length, 1);
});

test("a rejected Stash batch before saving leaves both actors untouched", async () => {
  const { app, target, stash, receipts } = stashApp();
  const originalError = console.error;
  Actor.implementation.updateDocuments = async () => { throw new Error("batch rejected"); };
  console.error = () => {};
  try { await bookCredits(app, "stash"); } finally { console.error = originalError; }
  assert.equal(target.system.credits.value, "8k");
  assert.equal(stash.system.credits.value, "2k");
  assert.equal(target.writes.length, 0);
  assert.equal(stash.writes.length, 0);
  assert.equal(receipts.length, 0);
});

test("both actor locks remain held until the Stash batch has finished saving", async () => {
  const { app, target, stash } = stashApp();
  const update = Actor.implementation.updateDocuments;
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  Actor.implementation.updateDocuments = async updates => { started(); await pending; return update(updates); };
  const first = bookCredits(app, "stash");
  await entered;
  await payShoreLeave(target, 100);
  await payShoreLeave(stash, 100);
  await bookCredits(app, "stash");
  assert.equal(target.writes.length, 0);
  assert.equal(stash.writes.length, 0);
  release(); await first;
  assert.equal(target.writes.length, 1);
  assert.equal(stash.writes.length, 1);
});

test("Stash rollback preserves a subsequent edit and reports the need to check balances", async () => {
  const { app, target, stash, receipts } = stashApp();
  const update = Actor.implementation.updateDocuments, originalError = console.error;
  Actor.implementation.updateDocuments = async updates => {
    await update(updates.slice(0, 1));
    target.system.credits.value = "9k";
    return [target];
  };
  console.error = () => {};
  try { await bookCredits(app, "stash"); } finally { console.error = originalError; }
  assert.equal(target.system.credits.value, "9k");
  assert.equal(stash.system.credits.value, "2k");
  assert.equal(batchWrites.length, 1);
  assert.ok(warnings.includes("MoshQoL.Currency.App.CheckBalances"));
  assert.equal(receipts.length, 0);
});

test("failed Stash compensation warns explicitly and never posts a success receipt", async () => {
  const { app, target, stash, receipts } = stashApp();
  const update = Actor.implementation.updateDocuments, originalError = console.error;
  let first = true;
  Actor.implementation.updateDocuments = async updates => {
    if (first) { first = false; return update(updates.slice(0, 1)); }
    throw new Error("rollback rejected");
  };
  console.error = () => {};
  try { await bookCredits(app, "stash"); } finally { console.error = originalError; }
  assert.equal(target.system.credits.value, "7.0 kcr");
  assert.equal(stash.system.credits.value, "2k");
  assert.ok(warnings.includes("MoshQoL.Currency.App.CheckBalances"));
  assert.equal(receipts.length, 0);
});
