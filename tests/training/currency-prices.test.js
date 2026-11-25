import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, settingsWrites, state } from "../helpers/foundry-environment.js";
import { actor } from "../currency/helpers.js";

const { TrainingConfigApp } = await import("../../scripts/settings/training-config.js");
const { getNormalizedTrainingConfig } = await import("../../scripts/training/config.js");
const { TrainingSkillSelectorApp } = await import("../../scripts/training/select-training-skill.js");

test.beforeEach(resetFoundryEnvironment);

test("training settings resolve every price before saving anything and remain open on cancellation", async () => {
  let closes = 0;
  const app = { close: () => closes++ };
  const formData = { object: { "training.prices.trained": "10k", "training.prices.expert": "bad", "training.prices.master": "200k" } };
  state.responses = [null];
  await TrainingConfigApp._onSubmit.call(app, null, null, formData);
  assert.deepEqual(settingsWrites, []); assert.equal(closes, 0);
  assert.equal(TrainingConfigApp.DEFAULT_OPTIONS.form.closeOnSubmit, false);
  state.responses = [{ input: "50k" }];
  await TrainingConfigApp._onSubmit.call(app, null, null, formData);
  assert.deepEqual(settingsWrites[0][2].prices, { trained: 10000, expert: 50000, master: 200000 });
  assert.equal(closes, 1);
});

test("stored invalid training prices are preserved and cancellation aborts skill selection before loading items", async () => {
  state.settings.trainingConfig = { prices: { trained: "bad" } };
  assert.equal(getNormalizedTrainingConfig().prices.trained, "bad");
  state.responses = [null];
  assert.equal(await TrainingSkillSelectorApp.wait({ actor: actor() }), null);
});
