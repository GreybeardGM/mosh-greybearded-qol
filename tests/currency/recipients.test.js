import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, batchWrites } from "../helpers/foundry-environment.js";
import { worldCreditActor } from "../currency/app-fixture.js";

const { CreditsApp } = await import("../../scripts/currency/credits-app.js");
const { getCreditRecipients, isCreditRecipient } = await import("../../scripts/currency/recipients.js");

test.beforeEach(resetFoundryEnvironment);

test("one recipient list includes only owned Stashes and player characters in world order", async () => {
  const source = worldCreditActor("source", "8k");
  const first = worldCreditActor("Z shared Stash", "bad", { stash: true, hasPlayerOwner: false });
  worldCreditActor("private Stash", "1k", { stash: true, isOwner: false });
  worldCreditActor("foreign player", "bad", { isOwner: false });
  const player = worldCreditActor("Z player", "bad");
  const second = worldCreditActor("A Stash", "2k", { stash: true });
  worldCreditActor("NPC", "1k", { hasPlayerOwner: false });
  worldCreditActor("creature", "1k", { type: "creature" });
  const other = worldCreditActor("A player", "1k");
  const app = new CreditsApp({ actor: source });
  const context = await app._prepareContext();
  assert.deepEqual(context.transferRecipients.map(entry => entry.id), [first.id, player.id, second.id, other.id]);
  assert.equal(context.transferRecipients[0].id, first.id);
  assert.deepEqual(context.buttons.map(button => button.action), ["receive", "pay"]);
  first.isOwner = false;
  player.isOwner = false;
  assert.deepEqual(getCreditRecipients(source).map(entry => entry.id), [second.id, other.id]);
  assert.equal(dialogs.length, 0);
  assert.equal(batchWrites.length, 0);
  for (const document of game.actors.contents) assert.deepEqual(document.writes, []);
});

test("an empty recipient list stays read-only and synthetic recipient copies are ineligible", async () => {
  const source = worldCreditActor("source", "bad");
  const foreign = worldCreditActor("foreign", "bad", { isOwner: false });
  assert.deepEqual(getCreditRecipients(source), []);
  const context = await new CreditsApp({ actor: source })._prepareContext();
  assert.deepEqual(context.transferRecipients, []);
  foreign.isOwner = true;
  assert.equal(isCreditRecipient(source, foreign), true);
  assert.equal(isCreditRecipient(source, { ...foreign, isToken: true }), false);
  assert.equal(dialogs.length, 0);
  assert.equal(batchWrites.length, 0);
  assert.deepEqual(source.writes, []);
  assert.deepEqual(foreign.writes, []);
});
