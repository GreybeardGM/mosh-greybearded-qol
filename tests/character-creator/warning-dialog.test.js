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

test("skill prerequisites still unlock dependent choices and prevent removing a required selection", async t => {
  const { SkillSelectorApp } = await import("../../scripts/character-creator/select-skills.js");
  const previousUi = globalThis.ui, warnings = [];
  globalThis.ui = { notifications: { warn: value => warnings.push(value) } };
  t.after(() => { globalThis.ui = previousUi; });
  const skills = [
    { id: "basic", name: "Basic", rank: "trained", prereqIds: [] },
    { id: "advanced", name: "Advanced", rank: "expert", prereqIds: ["basic"] }
  ];
  const card = ({ id, rank }) => {
    const classes = new Set();
    return { dataset: { skillId: id, rank }, classList: {
      contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value),
      toggle: (value, active) => active ? classes.add(value) : classes.delete(value)
    } };
  };
  const cards = skills.map(card), confirm = { ...card({}), disabled: true };
  const app = new SkillSelectorApp({
    actor: {}, sortedSkills: skills, skillMap: new Map(skills.map(skill => [skill.id, skill])),
    skillByUuid: new Map(), dependencies: new Map([["basic", new Set(["advanced"])]]),
    granted: new Set(), basePoints: { trained: 1, expert: 1, master: 0 }, orOptions: []
  });
  app._dom = { skillCards: cards, skillCardById: new Map(cards.map(card => [card.dataset.skillId, card])),
    skillCardsByRank: new Map(cards.map(card => [card.dataset.rank, [card]])), pointCounts: [], orOptions: [], confirm };
  app._scheduleDrawLines = () => {};
  app._updateUi();
  assert.equal(cards[1].classList.contains("is-locked"), true);
  SkillSelectorApp._onToggleSkill.call(app, null, cards[0]);
  assert.equal(cards[1].classList.contains("is-locked"), false);
  SkillSelectorApp._onToggleSkill.call(app, null, cards[1]);
  assert.equal(confirm.disabled, false);
  SkillSelectorApp._onToggleSkill.call(app, null, cards[0]);
  assert.deepEqual([...app._selectedSkillIds], ["basic", "advanced"]);
  assert.deepEqual(app.points, { trained: 0, expert: 0, master: 0 });
  assert.equal(warnings.length, 1);
});
