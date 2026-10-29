import test from "node:test";
import assert from "node:assert/strict";

globalThis.Option = class { style = {}; };
globalThis.foundry = {
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base } },
  utils: { getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object) }
};
let autoTrain, resolved, lookups, warnings;
globalThis.game = {
  i18n: { localize: key => key, format: (key, values) => ({ key, ...values }) },
  settings: { get: () => ({ useSkillTraining: true, autoTrainAfterShoreLeave: autoTrain }) }
};
globalThis.ui = { notifications: { warn: message => warnings.push(message), info() {} } };
globalThis.fromUuid = async uuid => {
  lookups.push(uuid);
  if (resolved instanceof Error) throw resolved;
  return resolved;
};

const { handleTrainingAction } = await import("../../scripts/training/training-action.js");
const { TrainingSkillSelectorApp } = await import("../../scripts/training/select-training-skill.js");
const { MODULE_ID, FLAG_TRAINING_SKILL } = await import("../../scripts/codex/constants.js");
const { TRAINING_SELECTED_SKILL_PATH, TRAINING_XP_VALUE_PATH } = await import("../../scripts/training/constants.js");

test.beforeEach(() => { autoTrain = true; resolved = null; lookups = []; warnings = []; });

function fixture(uuid = "Compendium.homebrew.skills.reference", xp = 4) {
  const writes = [], created = [], removedFlags = [];
  const actor = {
    name: "Crewmember", system: { xp: { value: xp, selectedSkill: "Old skill name" } },
    getFlag: () => uuid ? { uuid, name: "Unused old snapshot" } : undefined,
    update: async data => { writes.push(data); },
    createEmbeddedDocuments: async (_type, items) => { created.push(...items); return items; },
    unsetFlag: async (...args) => { removedFlags.push(args); }
  };
  return { actor, writes, created, removedFlags, render() {} };
}

function skill(name = "Renamed skill") {
  return { type: "skill", uuid: "Compendium.homebrew.skills.reference", name, system: { rank: "trained" },
    toObject: () => ({ _id: "reference", name, type: "skill", system: { rank: "trained" } }) };
}

test("training completes the UUID-selected skill after a rename, independently of the displayed name", async () => {
  const sheet = fixture();
  resolved = skill();
  await handleTrainingAction(sheet);
  assert.deepEqual(lookups, [resolved.uuid]);
  assert.equal(sheet.created[0].name, "Renamed skill");
  assert.equal(sheet.created[0]._id, undefined);
  assert.deepEqual(sheet.writes, [
    { [TRAINING_XP_VALUE_PATH]: 5, [TRAINING_SELECTED_SKILL_PATH]: "Renamed skill" },
    { [TRAINING_SELECTED_SKILL_PATH]: "", [TRAINING_XP_VALUE_PATH]: 0 }
  ]);
  assert.deepEqual(sheet.removedFlags, [[MODULE_ID, FLAG_TRAINING_SKILL]]);
});

test("an empty or manually changed display name never overrides the training UUID", async () => {
  for (const name of ["", "Different skill with the same name"]) {
    const sheet = fixture(undefined, 1);
    sheet.actor.system.xp.selectedSkill = name;
    resolved = skill();
    await handleTrainingAction(sheet);
    assert.deepEqual(sheet.writes, [{ [TRAINING_XP_VALUE_PATH]: 2, [TRAINING_SELECTED_SKILL_PATH]: resolved.name }]);
    assert.equal(sheet.created.length, 0);
  }
});

test("missing, inaccessible or non-skill UUIDs never award XP or select a same-named substitute", async () => {
  for (const result of [null, new Error("inaccessible UUID"), { type: "weapon", name: "Old skill name" }]) {
    const sheet = fixture();
    resolved = result;
    await handleTrainingAction(sheet);
    assert.deepEqual(sheet.writes, []);
    assert.deepEqual(sheet.created, []);
    assert.deepEqual(sheet.removedFlags, []);
  }
  assert.equal(warnings.length, 3);
});

test("a name-only legacy target requires explicit selection; cancellation preserves its progress", async t => {
  const originalWait = TrainingSkillSelectorApp.wait;
  t.after(() => { TrainingSkillSelectorApp.wait = originalWait; });
  const sheet = fixture(null);
  let selections = 0;
  TrainingSkillSelectorApp.wait = async () => { selections += 1; return null; };
  await handleTrainingAction(sheet);
  assert.equal(selections, 1);
  assert.deepEqual(lookups, []);
  assert.deepEqual(sheet.writes, []);
});

test("manual completion uses the UUID without incrementing XP when auto-training is off", async () => {
  autoTrain = false;
  const sheet = fixture(undefined, 5);
  resolved = skill();
  await handleTrainingAction(sheet);
  assert.equal(sheet.created.length, 1);
  assert.deepEqual(sheet.writes, [{ [TRAINING_SELECTED_SKILL_PATH]: "", [TRAINING_XP_VALUE_PATH]: 0 }]);
});

test("selecting a training target saves its UUID, display name and XP together without metadata snapshots", async () => {
  const sheet = fixture();
  resolved = skill();
  const app = {
    actor: sheet.actor, _selectedNewSkillId: "reference",
    _dom: { confirm: { classList: { contains: () => false } }, skillCards: [
      { dataset: { skillId: "reference", uuid: resolved.uuid } }
    ] }
  };
  await TrainingSkillSelectorApp._onSubmit.call(app);
  assert.deepEqual(sheet.writes, [{
    [`flags.${MODULE_ID}.${FLAG_TRAINING_SKILL}.uuid`]: resolved.uuid,
    [TRAINING_SELECTED_SKILL_PATH]: resolved.name, [TRAINING_XP_VALUE_PATH]: 1
  }]);
});
