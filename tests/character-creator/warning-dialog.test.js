import test from "node:test";
import assert from "node:assert/strict";

globalThis.Option = class { style = {}; };

let dialogChoice;
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: Base => Base,
      DialogV2: { wait: async () => dialogChoice }
    },
    handlebars: { renderTemplate: async () => "" }
  }
};
globalThis.game = {
  user: { isGM: true },
  i18n: { localize: key => key, format: key => key }
};

const { startCharacterCreation } = await import("../../scripts/character-creator/character-creator.js");

function makeActor({ completed = false } = {}) {
  const flags = new Map(completed ? [["greybeardCharacterCreation.completed", true]] : []);
  const writes = [];
  return {
    name: "Existing character",
    items: [{ id: "existing-item" }],
    writes,
    getFlag: (_module, path) => flags.get(path),
    setFlag: async (_module, path, value) => { writes.push(["flag", path, value]); flags.set(path, value); },
    unsetFlag: async () => { writes.push(["unset"]); },
    update: async () => { writes.push(["update"]); },
    deleteEmbeddedDocuments: async () => { writes.push(["deleteItems"]); }
  };
}

test("closing or cancelling the overwrite warning preserves the existing character", async () => {
  for (const choice of [null, "cancel", undefined]) {
    dialogChoice = choice;
    const actor = makeActor();
    await startCharacterCreation(actor);
    assert.deepEqual(actor.writes, [], `choice ${choice} must leave the actor untouched`);
    assert.equal(actor.items[0].id, "existing-item");
  }
});

test("marking the existing character complete only sets its completion flag", async () => {
  dialogChoice = "complete";
  const actor = makeActor();
  await startCharacterCreation(actor);
  assert.deepEqual(actor.writes, [["flag", "greybeardCharacterCreation.completed", true]]);
});

test("explicit overwrite marks the character ready and starts preparation", async () => {
  dialogChoice = "overwrite";
  const actor = makeActor();
  const preparationReached = new Error("preparation reached");
  actor.update = async () => { actor.writes.push(["update"]); throw preparationReached; };

  await assert.rejects(startCharacterCreation(actor), preparationReached);
  assert.deepEqual(actor.writes, [
    ["flag", "greybeardCharacterCreation.ready", true],
    ["update"]
  ]);
});

test("closing the already completed dialog does not reset the character", async () => {
  dialogChoice = null;
  const actor = makeActor({ completed: true });
  await startCharacterCreation(actor);
  assert.deepEqual(actor.writes, []);
});
