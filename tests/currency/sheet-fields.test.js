import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, warnings, state, property, BaseSheet } from "../helpers/foundry-environment.js";
import { actor } from "../currency/helpers.js";

const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { readCurrency } = await import("../../scripts/utils/currency.js");
const { payShoreLeave } = await import("../../scripts/chat-actions.js");
const { defineStashSheet } = await import("../../scripts/sheets/stash-sheet-class.js");
const { QoLContractorSheet } = await import("../../scripts/sheets/contractor-sheet-class.js");
const { attachCurrencyFieldHandlers } = await import("../../scripts/utils/currency-field.js");

test.beforeEach(resetFoundryEnvironment);

test("negative balances resolve and save normally in both sheets in every world notation", async () => {
  for (const notation of ["en", "de", "fr", "ch"]) {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: true, notation };
    const raw = notation === "de" || notation === "fr" ? "-1,5 Mcr" : "-1.5 Mcr";
    assert.equal(await readCurrency(-1500000), -1500000);
    assert.equal(await readCurrency(raw), -1500000);
    for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
      const target = actor(1000, { persist: true });
      await new Sheet(target)._updateObject(null, { [path]: raw });
      assert.equal(property(target, path), raw);
    }
  }
  assert.equal(dialogs.length, 0);
});

test("manual cancellation persists identical raw text in Stash and Contractor, including on close and reopen", async () => {
  for (const enabled of [true, false]) {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation: "en" };
    for (const response of ["cancel", null, undefined]) {
      for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
        const target = actor(1000, { persist: true });
        const sheet = new Sheet(target);
        const input = { defaultValue: "1000", value: "bad" };
        sheet.form = { elements: { namedItem: () => input } };
        state.responses = [response];
        await sheet._updateObject(null, { [path]: input.value, name: "New name" });
        assert.equal(property(target, path), "bad");
        assert.equal(input.value, "bad");
        assert.equal(input.defaultValue, "bad");
        assert.equal(target.name, "New name");
        const count = dialogs.length;
        // Foundry can submit the form again when closing. The saved text is not a new edit.
        await sheet._updateObject(null, { [path]: input.value });
        const reopened = new Sheet(target);
        await reopened._updateObject(null, { [path]: String(property(target, path)) });
        assert.equal(dialogs.length, count);
        assert.equal(property(target, path), "bad");
        assert.equal(path in target.writes[1], false);
        assert.equal(property(target.writes[1], path), undefined);
      }
    }
  }
});

test("form submissions do not overwrite a salary or balance changed during clarification", async () => {
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor(); const sheet = new Sheet(target);
    state.responses = [() => {
      if (path.includes("baseSalary")) target.system.contractor.baseSalary = 500;
      else target.system.credits.value = 500;
      return { input: "100" };
    }];
    await sheet._updateObject(null, { [path]: "bad" });
    assert.deepEqual(target.writes, []);
  }
});

test("failed manual saves keep the old baseline instead of silently accepting pending text", async () => {
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor();
    target.update = async () => { throw new Error("save failed"); };
    const sheet = new Sheet(target);
    const input = { defaultValue: "1000", value: "bad" };
    sheet.form = { elements: { namedItem: () => input } };
    state.responses = ["cancel"];
    await assert.rejects(sheet._updateObject(null, { [path]: input.value }), /save failed/);
    assert.equal(input.defaultValue, "1000");
    assert.equal(property(target, path), 1000);
  }
});

test("deliberately retained invalid sheet text still blocks automatic payments on cancellation", async () => {
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor(1000, { persist: true });
    state.responses = ["cancel"];
    await new Sheet(target)._updateObject(null, { [path]: "bad" });
    assert.equal(property(target, path), "bad");
    state.responses = ["cancel"];
    await payShoreLeave(target, path.includes("baseSalary") ? property(target, path) : 100);
    assert.equal(target.writes.length, 1);
    assert.equal(property(target, path), "bad");
  }
});

test("rendering, focus and blur never normalize or replace editable currency text", () => {
  const handlers = {};
  const display = { style: {} };
  const input = { value: "1,234", style: {}, closest: () => ({ querySelector: () => display }) };
  const chain = { on: (name, handler) => { handlers[name] = handler; return chain; }, each: handler => { handler.call(input); return chain; } };
  attachCurrencyFieldHandlers({ find: () => chain });
  assert.equal(input.value, "1,234"); assert.equal(display.textContent, "1,234 cr");
  handlers.focus.call(input); input.value = "<bad>"; handlers.blur.call(input);
  assert.equal(input.value, "<bad>"); assert.equal(display.textContent, "<bad>");
});

test("disabling the handler aborts payment but still allows a confirmed manual sheet correction", async () => {
  const target = actor("bad");
  state.responses = [() => {
    state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
    return { input: "1000" };
  }];
  await payShoreLeave(target, 100);
  assert.deepEqual(target.writes, []);
  state.settings[SETTING_CREDIT_HANDLER_CONFIG].enabled = true;
  state.responses = [() => { state.settings[SETTING_CREDIT_HANDLER_CONFIG].enabled = false; return { input: "1000" }; }];
  await new (defineStashSheet(BaseSheet))(target)._updateObject(null, { "system.credits.value": "new bad entry" });
  assert.equal(target.writes[0]["system.credits.value"], "1000");
});

test("manual edits are validated with automation off, preserving successful corrections as text", async () => {
  state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled: false, notation: "en" };
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor();
    state.responses = [{ input: "1.5 kCR" }];
    await new Sheet(target)._updateObject(null, { [path]: "manual invalid value" });
    const written = path.includes("baseSalary") ? property(target.writes[0], path) : target.writes[0][path];
    assert.equal(written, "1.5 kCR");
  }
  assert.equal(dialogs.length, 2);
});

test("manual sheet edits preserve valid spelling in every notation even with automation off", async () => {
  for (const [notation, value] of Object.entries({ en: "1,234.5 kCr", de: "1.234,5 kCr", fr: "1 234,5 kCr", ch: "1'234.5 kCr" })) {
    for (const enabled of [true, false]) {
      state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation };
      for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
        const target = actor();
        const form = { [path]: value };
        await new Sheet(target)._updateObject(null, form);
        assert.equal(form[path], value);
        const written = path.includes("baseSalary") ? property(target.writes[0], path) : target.writes[0][path];
        assert.equal(written, value);
      }
    }
  }
  assert.equal(dialogs.length, 0);
});

test("unchanged malformed, blank and numeric fields are omitted from unrelated sheet saves", async () => {
  for (const value of ["bad", "", null, undefined, 1234, 0]) {
    for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
      const target = actor(value);
      if (value === undefined) { delete target.system.credits.value; delete target.system.contractor.baseSalary; }
      const form = { [path]: String(value ?? ""), name: "Rename only" };
      await new Sheet(target)._updateObject(null, form);
      assert.equal(path in form, false);
      assert.equal(target.writes.length, 1);
      assert.equal(target.writes[0].name, "Rename only");
      const balance = path.includes("baseSalary") ? property(target.writes[0], path) : target.writes[0][path];
      assert.equal(balance, undefined);
    }
  }
  assert.equal(dialogs.length, 0);
});

test("cancelling a later manual correction saves the sheet's original text, not a failed dialog attempt", async () => {
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor("old malformed value", { persist: true });
    const sheet = new Sheet(target);
    const input = { defaultValue: "old malformed value", value: "new invalid value" };
    sheet.form = { elements: { namedItem: () => input } };
    const form = { [path]: input.value, name: "Pending rename" };
    state.responses = [{ input: "still bad" }, null];
    await sheet._updateObject(null, form);
    assert.equal(property(target, path), "new invalid value");
    assert.equal(input.value, "new invalid value");
    assert.equal(input.defaultValue, "new invalid value");
    input.value = "another invalid entry";
    state.responses = [{ input: "still bad" }, { input: "1.5 kCR" }];
    await sheet._updateObject(null, { [path]: input.value });
    assert.equal(input.value, "1.5 kCR");
    assert.equal(input.defaultValue, "1.5 kCR");
    assert.equal(property(target, path), "1.5 kCR");
    assert.equal(target.writes.length, 2);
  }
});

test("stale forms never overwrite another user's currency with untouched or explicitly edited text", async () => {
  for (const [Sheet, path] of [[defineStashSheet(BaseSheet), "system.credits.value"], [QoLContractorSheet, "system.contractor.baseSalary"]]) {
    const target = actor(2000);
    const sheet = new Sheet(target);
    const input = { defaultValue: "1000", value: "1000" };
    sheet.form = { elements: { namedItem: () => input } };
    await sheet._updateObject(null, { [path]: "1000", name: "Rename" });
    assert.equal(target.writes.length, 1);
    assert.equal(path.includes("baseSalary") ? property(target.writes[0], path) : target.writes[0][path], undefined);
    target.writes.length = 0;
    input.value = "1500";
    await sheet._updateObject(null, { [path]: "1500", name: "Rename" });
    assert.deepEqual(target.writes, []);
  }
  assert.equal(dialogs.length, 0);
  assert.equal(warnings.length, 2);
});

test("contractor rendering preserves unknown fields and does not invent zero wages", async () => {
  for (const value of [null, undefined, "bad", "1.5 kCR", 0]) {
    const target = actor(value);
    if (value === undefined) delete target.system.contractor.baseSalary;
    target.system.contractor.extra = "preserve";
    const context = await new QoLContractorSheet(target).getData();
    assert.equal(context.system.contractor.baseSalary, value ?? "");
    assert.equal(context.system.contractor.extra, "preserve");
    assert.equal(target.system.contractor.baseSalary, value);
    assert.deepEqual(target.writes, []);
  }
  assert.equal(dialogs.length, 0);
});
