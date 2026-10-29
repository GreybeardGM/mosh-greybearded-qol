import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoster, normalizeRosterWithChanges } from "../../scripts/crew-roster/roster-data.js";

test("legacy entries, inactive flags, duplicate UUIDs and malformed rows share one immutable normalized shape", () => {
  const source = {
    character: [" Actor.A ", { uuid: "Actor.A", active: false }, null, { uuid: " " },
      { uuid: "Actor.B", active: false, hazardPay: "3" }],
    creature: [{ uuid: "Actor.C", hazardPay: 2 }], ship: [], obsolete: ["Actor.old"]
  };
  const before = structuredClone(source);
  const { roster, changed } = normalizeRosterWithChanges(source);
  assert.equal(changed, true);
  assert.deepEqual(roster, {
    character: [{ uuid: "Actor.A", active: true, hazardPay: null }, { uuid: "Actor.B", active: false, hazardPay: 3 }],
    creature: [{ uuid: "Actor.C", active: true, hazardPay: 2 }], ship: []
  });
  assert.deepEqual(source, before);
  assert.equal(normalizeRosterWithChanges(roster).changed, false);
});

test("missing or malformed roster buckets always produce iterable lists", () => {
  for (const source of [undefined, null, [], 123, { character: "bad", creature: null }]) {
    assert.deepEqual(normalizeRoster(source), { character: [], creature: [], ship: [] });
  }
});

globalThis.Option = class { style = {}; };
globalThis.foundry = {
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base } },
  utils: { escapeHTML: value => String(value) }
};
globalThis.game = { user: {}, settings: { get: () => "" }, i18n: { localize: key => key, format: key => key } };
const { ShipCrewRosterApp } = await import("../../scripts/ship-crew-roster.js");
const { SbtCrewSkillRollApp } = await import("../../scripts/sbt-crew-skill-roll.js");

test("Roster and SBT agree on legacy rows and inactive duplicates without writes from the roll dialog", async () => {
  const actors = new Map(["A", "B", "C"].map((id, index) => [`Actor.${id}`, {
    uuid: `Actor.${id}`, documentName: "Actor", type: index === 2 ? "creature" : "character", name: id,
    items: [{ type: "skill", name: "Piloting", system: { bonus: 10 } }]
  }]));
  const lookups = [];
  globalThis.fromUuid = async uuid => { lookups.push(uuid); return actors.get(uuid); };
  const source = {
    character: [" Actor.A ", { uuid: "Actor.B", active: false }, { uuid: "Actor.B", active: true }],
    creature: ["Actor.C", "Actor.A"], ship: ["Actor.Ship"]
  };
  const { cleanedRoster } = await new ShipCrewRosterApp()._resolveCleanRoster(source);
  const activeCrew = [...cleanedRoster.character, ...cleanedRoster.creature].filter(entry => entry.active).map(entry => entry.uuid);
  lookups.length = 0;
  const ship = { getFlag: () => source, update() { throw new Error("roll rendering must not write"); } };
  const context = await new SbtCrewSkillRollApp({ ship, statKey: "systems" })._prepareContext();
  assert.deepEqual(lookups, activeCrew);
  assert.deepEqual(context.crewGroups.map(group => group.name), ["A", "C"]);
  assert.equal(source.character.length, 3);
});
