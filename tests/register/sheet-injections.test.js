import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment } from "../helpers/foundry-environment.js";


test.beforeEach(resetFoundryEnvironment);

test("SBT and Cyberware injections use live native or wrapped sheet roots and fall back to hook HTML", async t => {
  const previousHooks = globalThis.Hooks, hooks = new Map();
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  t.after(() => { globalThis.Hooks = previousHooks; });
  const { registerCyberwareHooks } = await import("../../scripts/cyberware/sheets.js");
  const { augmentSbtShipSkillRolls } = await import("../../scripts/sbt-crew-skill-roll.js");
  registerCyberwareHooks();
  const live = new HTMLElement(), fragment = new HTMLElement(), queries = [];
  live.querySelectorAll = selector => { queries.push(["live", selector]); return []; };
  fragment.querySelectorAll = selector => { queries.push(["fragment", selector]); return []; };
  for (const element of [live, [live], null]) {
    queries.length = 0;
    hooks.get("renderMothershipItemSheet")({ element }, [fragment]);
    hooks.get("renderActorSheet")({ actor: { type: "character" }, element }, [fragment]);
    augmentSbtShipSkillRolls({ actor: { type: "ship" }, element,
      options: { template: "systems/mosh/templates/actor/ship-sheet-sbt.html" } }, [fragment]);
    assert.deepEqual(queries.map(([root]) => root), Array(3).fill(element ? "live" : "fragment"));
    assert.deepEqual(queries.map(([, selector]) => selector), [".qol-augmentation-row", ".qol-augmentation-status", ".stat-roll[data-key]"]);
  }
});
