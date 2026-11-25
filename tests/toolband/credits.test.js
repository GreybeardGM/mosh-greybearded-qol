import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, state } from "../helpers/foundry-environment.js";
import { actor } from "../currency/helpers.js";

const { SETTING_CREDIT_HANDLER_CONFIG } = await import("../../scripts/codex/constants.js");
const { CreditsApp } = await import("../../scripts/currency/credits-app.js");
const { upsertToolband } = await import("../../scripts/toolband.js");
const { getDefaultToolbandConfig, normalizeToolbandConfig } = await import("../../scripts/toolband/config.js");
const { getConfigurableToolbandButtonsForScope } = await import("../../scripts/codex/toolband-buttons.js");

test.beforeEach(resetFoundryEnvironment);

test("Credits toolbar scopes inherit enabled defaults without changing existing preferences", () => {
  for (const scope of ["character", "stash"]) {
    assert.ok(getConfigurableToolbandButtonsForScope(scope).some(button => button.action === "credits"));
    assert.equal(getDefaultToolbandConfig()[scope].credits, true);
    assert.equal(normalizeToolbandConfig({ [scope]: { credits: false } })[scope].credits, false);
    assert.equal(normalizeToolbandConfig({ [scope]: { crewRoster: false } })[scope].credits, true);
  }
  for (const scope of ["contractor", "creature", "ship"]) {
    assert.ok(!getConfigurableToolbandButtonsForScope(scope).some(button => button.action === "credits"));
  }
  assert.deepEqual(Object.keys(CreditsApp.DEFAULT_OPTIONS.actions), ["receive", "pay", "transfer", "cancel"]);
  assert.ok(CreditsApp.DEFAULT_OPTIONS.window.contentClasses.includes("greybeardqol"));
  assert.ok(CreditsApp.DEFAULT_OPTIONS.window.contentClasses.includes("qol-ui"));
  assert.equal(CreditsApp.DEFAULT_OPTIONS.position.width, 480);
});

test("the real toolbar renders and opens Credits only for editable character and stash scopes with the handler enabled", async () => {
  class Node extends HTMLElement {
    children = []; dataset = {}; listeners = {}; style = { setProperty() {} };
    classList = { add() {}, toggle() {} };
    setAttribute(name, value) { if (name === "data-action") this.dataset.action = value; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
  }
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => new Node() };
  try {
    for (const kind of ["character", "stash", "contractor", "creature", "ship"]) {
      for (const enabled of [true, false]) {
        for (const isOwner of [true, false]) {
          state.settings[SETTING_CREDIT_HANDLER_CONFIG] = { enabled, notation: "en" };
          const target = { ...actor(), isOwner, getFlag: () => false };
          let bar;
          const header = { insertAdjacentElement: (_position, node) => { bar = node; } };
          const root = Object.assign(new Node(), { querySelector: selector => selector === ".window-header" ? header : bar });
          const sheet = { actor: target, appId: 123 };
          if (enabled) sheet.element = root;
          else if (isOwner) sheet.element = [root];
          const fragment = Object.assign(new Node(), { querySelector() { throw new Error("Live window must take precedence over render fragments"); } });
          upsertToolband(sheet, [sheet.element ? fragment : root], { kind });
          const button = bar.children.find(node => node.dataset.action === "credits");
          assert.equal(Boolean(button), ["character", "stash"].includes(kind) && enabled && isOwner);
          if (button) {
            const app = await bar.listeners.click({ target: { closest: () => button }, preventDefault() {}, stopPropagation() {} });
            assert.ok(app instanceof CreditsApp);
            assert.equal(app.actor, target);
          }
        }
      }
    }
  } finally { globalThis.document = previousDocument; }
});
