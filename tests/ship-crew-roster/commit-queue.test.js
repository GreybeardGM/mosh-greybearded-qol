import test from "node:test";
import assert from "node:assert/strict";

globalThis.Option = class { style = {}; };
globalThis.HTMLFormElement = class {};
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: Base => Base
    }
  }
};
globalThis.game = { i18n: { localize: key => key } };
const errors = [];
globalThis.ui = { notifications: { error: message => errors.push(message) } };

const actors = new Map([
  ["Actor.A", { uuid: "Actor.A", documentName: "Actor", type: "character" }],
  ["Actor.B", { uuid: "Actor.B", documentName: "Actor", type: "character" }],
  ["Actor.C", { uuid: "Actor.C", documentName: "Actor", type: "character" }],
  ["Actor.X", { uuid: "Actor.X", documentName: "Actor", type: "creature" }]
]);
globalThis.fromUuid = async uuid => actors.get(uuid) ?? null;
globalThis.TextEditor = { getDragEventData: () => ({ type: "Actor", uuid: "Actor.C" }) };

const { ShipCrewRosterApp } = await import("../../scripts/ship-crew-roster.js");

function makeRoster() {
  return {
    character: [
      { uuid: "Actor.A", active: true, hazardPay: null },
      { uuid: "Actor.B", active: true, hazardPay: null }
    ],
    creature: [{ uuid: "Actor.X", active: true, hazardPay: null }],
    ship: []
  };
}

function makeApp(setFlag) {
  let stored = makeRoster();
  const actor = {
    getFlag: () => structuredClone(stored),
    setFlag: async (_module, _flag, value) => {
      await setFlag?.();
      stored = structuredClone(value);
    }
  };
  const app = new ShipCrewRosterApp({ actor });
  app.render = () => app;
  return { app, getStored: () => stored };
}

function actionEvent() {
  return { preventDefault() {}, stopPropagation() {} };
}

test("edits made during a slow save preserve toggles, removal, hazard pay and dropped actors", async () => {
  let releaseFirstSave;
  const firstSave = new Promise(resolve => { releaseFirstSave = resolve; });
  let writes = 0;
  const { app, getStored } = makeApp(async () => {
    if (++writes === 1) await firstSave;
  });

  const toggle = ShipCrewRosterApp._onToggleActive.call(app, actionEvent(), {
    dataset: { tab: "character", uuid: "Actor.A" }, checked: false
  });
  // Allow the first commit to enter setFlag; subsequent edits use its unsaved draft.
  await new Promise(resolve => setImmediate(resolve));
  const remove = ShipCrewRosterApp._onRemoveEntry.call(app, actionEvent(), {
    dataset: { tab: "character", uuid: "Actor.B" }
  });
  const hazard = ShipCrewRosterApp._onSubmit.call(app, null, {}, {
    object: { "hazardPay.creature.Actor.X": "3" }
  });
  const drop = app._onDrop(actionEvent());

  assert.equal(getStored().character[0].active, true);
  releaseFirstSave();
  await Promise.all([toggle, remove, hazard, drop]);
  await app._commitInFlight;
  const roster = getStored();
  assert.deepEqual(roster.character.map(entry => [entry.uuid, entry.active]), [
    ["Actor.A", false], ["Actor.C", true]
  ]);
  assert.equal(roster.creature[0].hazardPay, 3);
  assert.equal(writes, 4);
});

test("a rejected save reports the error, discards its draft, and allows a later save", async () => {
  errors.length = 0;
  let writes = 0;
  const { app, getStored } = makeApp(async () => {
    if (++writes === 1) throw new Error("save failed");
  });
  const previousConsoleError = console.error;
  console.error = () => {};
  try {
    const target = { dataset: { tab: "character", uuid: "Actor.A" }, checked: false };
    assert.equal(await ShipCrewRosterApp._onToggleActive.call(app, actionEvent(), target), undefined);
    assert.equal(getStored().character[0].active, true);
    assert.equal(app._rosterDraft, null);
    assert.deepEqual(errors, ["MoshQoL.CrewRoster.SaveError"]);

    await ShipCrewRosterApp._onToggleActive.call(app, actionEvent(), target);
    assert.equal(getStored().character[0].active, false);
    assert.equal(writes, 2);
  } finally {
    console.error = previousConsoleError;
  }
});

test("an old render cleanup does not overwrite a newer saved roster", async () => {
  let writes = 0;
  const { app, getStored } = makeApp(async () => { writes += 1; });
  await ShipCrewRosterApp._onRemoveEntry.call(app, actionEvent(), {
    dataset: { tab: "character", uuid: "Actor.B" }
  });

  const staleCandidate = { cleanedRoster: makeRoster(), rosterChanged: true };
  assert.equal(await app._cleanupRosterFlagIfNeeded(staleCandidate), false);
  assert.deepEqual(getStored().character.map(entry => entry.uuid), ["Actor.A"]);
  assert.equal(writes, 1);
});
