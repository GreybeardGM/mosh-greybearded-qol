import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs } from "../helpers/foundry-environment.js";
import { actor } from "../currency/helpers.js";

const { ShipCrewRosterApp } = await import("../../scripts/ship-crew-roster.js");

test.beforeEach(resetFoundryEnvironment);

test("roster salaries use the interpreter and sum exactly without punctuation stripping", async () => {
  const actors = new Map([
    ["Actor.A", { ...actor("1.5 kcr"), documentName: "Actor", type: "creature" }],
    ["Actor.B", { ...actor(2500), documentName: "Actor", type: "creature" }]
  ]);
  globalThis.fromUuid = async uuid => actors.get(uuid);
  const app = new ShipCrewRosterApp();
  const context = await app._buildRosterContext({ creature: [
    { uuid: "Actor.A", active: true, hazardPay: 2 }, { uuid: "Actor.B", active: true, hazardPay: 3 }
  ] });
  assert.equal(context.summary.totalSalary, 4000);
  assert.equal(context.summary.totalHazardPay, 10500);
});

test("invalid salaries are shown as unknown on repeated roster renders without dialogs or actor writes", async () => {
  const member = { ...actor("bad"), documentName: "Actor", type: "creature" };
  globalThis.fromUuid = async () => member;
  const ship = { getFlag: () => ({ creature: [{ uuid: "Actor.A", active: true, hazardPay: 2 }] }) };
  const app = new ShipCrewRosterApp({ actor: ship });
  for (let render = 0; render < 2; render++) {
    const context = await app._prepareContext();
    assert.equal(context.entries.creature[0].salary, "MoshQoL.CrewRoster.UnknownSalary");
    assert.equal(context.summary.totalSalary, "MoshQoL.Currency.Unavailable");
    assert.equal(context.summary.totalHazardPay, "MoshQoL.Currency.Unavailable");
  }
  assert.equal(dialogs.length, 0);
  assert.deepEqual(member.writes, []);
  assert.equal(member.system.contractor.baseSalary, "bad");
});

test("payroll overflow never rounds or prompts for a manual replacement total", async () => {
  for (const salary of [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]) {
    const member = { ...actor(salary), documentName: "Actor", type: "creature" };
    globalThis.fromUuid = async () => member;
    const context = await new ShipCrewRosterApp()._buildRosterContext({ creature: [{ uuid: "Actor.A", active: true, hazardPay: 2 }] });
    assert.equal(context.summary.totalSalary, salary);
    assert.equal(context.summary.totalHazardPay, null);
  }
  assert.equal(dialogs.length, 0);
});

test("inactive invalid wages do not spoil valid roster totals; active invalid wages never look like a partial sum", async () => {
  const actors = new Map([
    ["Actor.A", { ...actor("1.5 kCR"), documentName: "Actor", type: "creature" }],
    ["Actor.B", { ...actor("bad"), documentName: "Actor", type: "creature" }]
  ]);
  globalThis.fromUuid = async uuid => actors.get(uuid);
  const app = new ShipCrewRosterApp();
  for (const active of [false, true]) {
    const context = await app._buildRosterContext({ creature: [
      { uuid: "Actor.A", active: true, hazardPay: 2 }, { uuid: "Actor.B", active, hazardPay: 3 }
    ] });
    assert.equal(context.summary.totalSalary, active ? null : 1500);
    assert.equal(context.summary.totalHazardPay, active ? null : 3000);
    assert.equal(context.entries.creature.find(entry => entry.uuid === "Actor.B").salary, "MoshQoL.CrewRoster.UnknownSalary");
  }
  assert.equal(dialogs.length, 0);
});
