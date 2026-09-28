import test from "node:test";
import assert from "node:assert/strict";

globalThis.Option = class { style = {}; };
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: Base => Base
    },
    handlebars: { renderTemplate: async () => "" }
  },
  utils: { deepClone: structuredClone, escapeHTML: value => value }
};

let skipSanitySave = false;
globalThis.game = {
  user: { color: "" },
  i18n: { localize: key => key },
  settings: {
    get: (_module, key) => {
      if (key === "shoreLeaveConfig") return { convertStress: { noSanitySave: skipSanitySave } };
      if (key === "trainingConfig") return { autoTrainAfterShoreLeave: true };
      return null;
    }
  }
};
globalThis.ui = { notifications: { warn() {}, error() {} } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.Roll = class {
  total = 1;
  async evaluate() { return this; }
  async toMessage() { return {}; }
};

const { StressDistributionApp } = await import("../../scripts/shore-leave/stress-distribution.js");
const { SimpleShoreLeave } = await import("../../scripts/shore-leave/simple-shore-leave.js");

test("auto-training starts only after a completed shore leave conversion", async () => {
  const originalWait = StressDistributionApp.wait;
  const originalSetTimeout = globalThis.setTimeout;
  const scheduledTraining = [];
  let distribution = null;
  StressDistributionApp.wait = async () => distribution;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay === 0) {
      scheduledTraining.push(callback);
      return 1;
    }
    return originalSetTimeout(callback, delay, ...args);
  };

  try {
    for (const scenario of [
      { stress: 2, skipSave: false, saveSucceeded: false, distribution: null, result: "none", trainings: 0 },
      { stress: 5, skipSave: false, saveSucceeded: false, distribution: null, result: "nochange", trainings: 0 },
      { stress: 5, skipSave: true, saveSucceeded: true, distribution: null, result: "canceled", trainings: 0 },
      { stress: 5, skipSave: true, saveSucceeded: true, distribution: { sanity: 1, fear: 2, body: 3 }, result: "success", trainings: 1 }
    ]) {
      skipSanitySave = scenario.skipSave;
      distribution = scenario.distribution;
      const actor = {
        name: "Crewmember",
        system: { other: { stress: { value: scenario.stress, min: 2 } } },
        rollCheck: async () => ({ success: scenario.saveSucceeded }),
        update: async () => {}
      };
      let resolved;
      const app = {
        actor,
        _getTier: () => ({ stressFormula: "1d5" }),
        _resolve: result => { resolved = result; }
      };

      await SimpleShoreLeave._onSubmit.call(app, null, null, { object: { "shore-tier": "X" } });
      assert.equal(resolved?.result, scenario.result);
      assert.equal(scheduledTraining.length, scenario.trainings, scenario.result);
    }
  } finally {
    StressDistributionApp.wait = originalWait;
    globalThis.setTimeout = originalSetTimeout;
  }
});
