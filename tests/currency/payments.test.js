import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, warnings, state } from "../helpers/foundry-environment.js";
import { actor } from "../currency/helpers.js";

const { classifyCurrency } = await import("../../scripts/utils/currency-parser.js");
const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { payShoreLeave } = await import("../../scripts/chat-actions.js");

test.beforeEach(resetFoundryEnvironment);

test("cancelling a later correction keeps the original actor untouched", async () => {
  const target = actor("wrong");
  state.responses = [{ input: "1.234" }, "cancel"];
  await payShoreLeave(target, 200);
  assert.deepEqual(target.writes, []);
  assert.equal(target.system.credits.value, "wrong");
});

test("a cancelled or absent payable amount never becomes a zero or deducted payment", async () => {
  for (const amount of ["bad", "1.234", undefined]) {
    const target = actor(); state.responses = [null];
    await payShoreLeave(target, amount);
    assert.deepEqual(target.writes, []);
  }
});

test("resolved actor and manual payment amounts are used exactly once", async () => {
  const target = actor("1.5 MCR");
  await payShoreLeave(target, "250 kcr");
  assert.deepEqual(target.writes, [{ "system.credits.value": "1,250.0 kcr" }]);
});

test("payments store the world notation and can spend the formatted balance again without precision loss", async () => {
  const grouped = { en: "1,234,567 cr", de: "1.234.567 cr", fr: "1\u202f234\u202f567 cr", ch: "1\u2019234\u2019567 cr" };
  for (const notation of ["en", "de", "fr", "ch"]) {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation };
    for (const remaining of [0, 99, 1500, 1234567, 1500000, 1500000000, Number.MAX_SAFE_INTEGER - 1]) {
      const target = actor(remaining + 1, { persist: true });
      await payShoreLeave(target, 1);
      const stored = target.system.credits.value;
      assert.equal(typeof stored, "string");
      assert.deepEqual(classifyCurrency(stored), { status: "success", value: remaining });
      if (remaining === 1234567) assert.equal(stored, grouped[notation]);
      if (remaining === 1500) assert.equal(stored, notation === "de" || notation === "fr" ? "1,5 kcr" : "1.5 kcr");
      if (remaining === 1500000) assert.equal(stored, notation === "de" || notation === "fr" ? "1,5 Mcr" : "1.5 Mcr");
      if (remaining === 1500000000) assert.equal(stored, notation === "de" || notation === "fr" ? "1,5 Gcr" : "1.5 Gcr");
      if (remaining > 0) {
        await payShoreLeave(target, 1);
        assert.equal(classifyCurrency(target.system.credits.value).value, remaining - 1);
        assert.equal(target.writes.length, 2);
      }
    }
  }
  assert.equal(dialogs.length, 0);
});

test("insufficient funds and zero price do not write currency", async () => {
  const target = actor(100);
  await payShoreLeave(target, 101);
  await payShoreLeave(target, 0);
  assert.deepEqual(target.writes, []);
  assert.equal(warnings.length, 1);
});

test("negative balances cannot pay and negative prices cannot become refunds", async () => {
  const indebted = actor("-1.5 kcr");
  await payShoreLeave(indebted, 100);
  assert.deepEqual(indebted.writes, []);
  assert.equal(warnings.length, 1);
  const target = actor(1000);
  for (const amount of [-100, "-0.1 kcr"]) await payShoreLeave(target, amount);
  assert.deepEqual(target.writes, []);
  assert.equal(dialogs.length, 0);
});

test("balance changes while a dialog is open abort the pending payment", async () => {
  const target = actor("bad");
  state.responses = [() => { target.system.credits.value = 5000; return { input: "1.234 kcr" }; }];
  await payShoreLeave(target, 100);
  assert.deepEqual(target.writes, []);
  assert.deepEqual(warnings, ["MoshQoL.Currency.Changed"]);
});

test("duplicate clicks cannot deduct a stale balance during a slow save", async () => {
  const target = actor();
  let release, started;
  const pending = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  target.update = async data => { target.writes.push(data); started(); await pending; target.system.credits.value = data["system.credits.value"]; };
  const first = payShoreLeave(target, 100);
  await entered;
  await payShoreLeave(target, 100);
  release(); await first;
  assert.deepEqual(target.writes, [{ "system.credits.value": "0.9 kcr" }]);
  await payShoreLeave(target, 100);
  assert.equal(target.system.credits.value, "0.8 kcr");
});

test("failed payments release their guard so a subsequent action can run", async () => {
  const target = actor();
  target.update = async () => { throw new Error("save failed"); };
  await assert.rejects(payShoreLeave(target, 100), /save failed/);
  target.update = async data => target.writes.push(data);
  await payShoreLeave(target, 100);
  assert.equal(target.writes.length, 1);
});

test("disabled handler never parses or pays, including calls from existing chat cards", async () => {
  state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
  const target = actor("bad");
  await payShoreLeave(target, "also bad");
  assert.deepEqual(target.writes, []);
  assert.equal(dialogs.length, 0);
});
