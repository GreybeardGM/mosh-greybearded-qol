import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, contexts, warnings, state } from "../helpers/foundry-environment.js";
import { creditApp, bookCredits } from "../currency/app-fixture.js";

const { classifyCurrency, formatCurrency } = await import("../../scripts/utils/currency-parser.js");
const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { payShoreLeave } = await import("../../scripts/chat-actions.js");
const { CreditsApp } = await import("../../scripts/currency/credits-app.js");

test.beforeEach(resetFoundryEnvironment);

test("opening Credits only formats the displayed balance and never prompts or writes", async () => {
  for (const balance of ["bad", "-1.5 kcr", 1234567]) {
    const { app, target } = creditApp(balance, "");
    const context = await app._prepareContext();
    assert.equal(context.balance, balance === "bad" ? balance : formatCurrency(balance));
    assert.deepEqual(target.writes, []);
    assert.deepEqual(context.buttons.map(button => button.icon), ["fa-circle-plus", "fa-circle-minus"]);
  }
  assert.equal(dialogs.length, 0);
});

test("Credits Receive and Pay validate both fields, save exact formatted balances and post receipts in every notation", async () => {
  for (const notation of ["en", "de", "fr", "ch"]) {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation };
    for (const [balance, inputValue, operation, after] of [["8k", "7k", "pay", 1000], ["-8k", "7k", "receive", -1000], ["8k", "7k", "receive", 15000]]) {
      const { app, target, receipts } = creditApp(balance, inputValue);
      await bookCredits(app, operation);
      assert.equal(classifyCurrency(target.system.credits.value).value, after);
      assert.equal(target.writes.length, 1);
      assert.equal(app.closed, true);
      assert.equal(receipts.length, 1);
      const receipt = contexts.at(-1);
      assert.equal(receipt.icon, operation === "pay" ? "fa-circle-minus" : "fa-circle-plus");
      assert.equal(classifyCurrency(receipt.blocks[0].value).value, operation === "pay" ? -7000 : 7000);
      assert.equal(classifyCurrency(receipt.blocks[2].value).value, after);
    }
  }
  assert.equal(dialogs.length, 0);
});

test("cancelling either invalid Credits field, or a later field after repairing the balance, never writes or posts", async () => {
  for (const cancel of ["cancel", null, undefined]) {
    for (const [balance, inputValue, replies] of [["8k", "bad", [cancel]], ["bad", "7k", [cancel]], ["bad", "also bad", [{ input: "8k" }, cancel]]]) {
      const { app, target, input, buttons, receipts } = creditApp(balance, inputValue);
      state.responses = replies;
      await bookCredits(app, "pay");
      assert.deepEqual(target.writes, []);
      assert.equal(target.system.credits.value, balance);
      assert.equal(receipts.length, 0);
      assert.equal(app.closed, undefined);
      assert.equal(input.readOnly, false);
      assert.ok(buttons.every(button => !button.disabled));
      assert.equal(state.responses.length, 0);
    }
  }
});

test("repeated repairs use the accepted amount and balance in one final Credits update", async () => {
  const { app, target, receipts } = creditApp("broken", "bad");
  state.responses = [{ input: "still bad" }, { input: "1,234 cr" }, { input: "0.1 kcr" }];
  await bookCredits(app, "receive");
  assert.deepEqual(target.writes, [{ "system.credits.value": "1,334 cr" }]);
  assert.equal(dialogs.length, 3);
  assert.equal(receipts.length, 1);
});

test("Cancel and closing the Credits app abort before writing, including while a repair is pending", async () => {
  for (const duringRepair of [false, true]) {
    const { app, target, receipts } = creditApp("8k", duringRepair ? "bad" : "1k");
    if (duringRepair) state.responses = [async () => { await CreditsApp._onCancel.call(app); return { input: "1k" }; }];
    else await app.close();
    await bookCredits(app, "pay");
    assert.deepEqual(target.writes, []);
    assert.equal(receipts.length, 0);
  }
});

test("changed balances, notation, permissions and handler activation abort pending Credits transactions", async () => {
  for (const change of [
    target => { target.system.credits.value = 123; },
    () => { state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation: "de" }; },
    target => { target.isOwner = false; },
    () => { state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" }; }
  ]) {
    state.settings = {};
    const { app, target, receipts } = creditApp("8k", "bad");
    state.responses = [() => { change(target); return { input: "1k" }; }];
    await bookCredits(app, "pay");
    assert.deepEqual(target.writes, []);
    assert.equal(receipts.length, 0);
  }
});

test("Credits operations stop on sign conflicts, insufficient funds, zero and overflow; negative Pay is not a refund", async () => {
  for (const [balance, inputValue, operation] of [["8k", "-1k", "receive"], ["1k", "2k", "pay"], ["8k", "0", "receive"], [Number.MAX_SAFE_INTEGER, "1", "receive"]]) {
    const { app, target, receipts } = creditApp(balance, inputValue);
    await bookCredits(app, operation);
    assert.deepEqual(target.writes, []);
    assert.equal(receipts.length, 0);
  }
  const { app, target } = creditApp("8k", "-1k");
  await bookCredits(app, "pay");
  assert.equal(classifyCurrency(target.system.credits.value).value, 7000);
  assert.equal(dialogs.length, 0);
});

test("read-only actors and a disabled handler cannot book through Credits", async () => {
  for (const disabled of [true, false]) {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: !disabled, notation: "en" };
    const { app, target, receipts } = creditApp("bad", "also bad");
    target.isOwner = disabled;
    await bookCredits(app, "receive");
    assert.deepEqual(target.writes, []);
    assert.equal(receipts.length, 0);
  }
  assert.equal(dialogs.length, 0);
});

test("the Credits app and Pay Up share a lock until a slow update completes", async () => {
  const { app, target, receipts } = creditApp("8k", "1k");
  const second = creditApp("8k", "2k").app;
  second.actor = target;
  let release, started;
  const pending = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  const update = target.update;
  target.update = async data => { started(); await pending; return update(data); };
  const first = bookCredits(app, "pay");
  await entered;
  await bookCredits(app, "pay");
  await bookCredits(second, "pay");
  await payShoreLeave(target, 100);
  release(); await first;
  assert.equal(target.writes.length, 1);
  assert.equal(classifyCurrency(target.system.credits.value).value, 7000);
  await payShoreLeave(target, 100);
  assert.equal(classifyCurrency(target.system.credits.value).value, 6900);
  assert.equal(target.writes.length, 2);
});

test("a failed Credits save posts no receipt, preserves the balance and releases the transaction lock", async () => {
  const { app, target, receipts } = creditApp("8k", "1k");
  const update = target.update, originalError = console.error;
  target.update = async () => { throw new Error("save failed"); };
  console.error = () => {};
  try { await bookCredits(app, "pay"); } finally { console.error = originalError; }
  assert.equal(target.system.credits.value, "8k");
  assert.equal(receipts.length, 0);
  assert.equal(app.closed, undefined);
  assert.ok(warnings.includes("MoshQoL.Currency.App.SaveError"));
  target.update = update;
  await bookCredits(app, "pay");
  assert.equal(target.writes.length, 1);
});

test("a failed chat receipt cannot repeat a successfully saved Credits transaction", async () => {
  const { app, target } = creditApp("8k", "1k");
  const originalError = console.error;
  ChatMessage.create = async () => { throw new Error("chat failed"); };
  console.error = () => {};
  try { await bookCredits(app, "pay"); } finally { console.error = originalError; }
  await bookCredits(app, "pay");
  assert.equal(target.writes.length, 1);
  assert.equal(app.closed, true);
  assert.ok(warnings.includes("MoshQoL.Currency.App.ChatError"));
});
