import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment, dialogs, batchWrites } from "../helpers/foundry-environment.js";
import { worldCreditActor } from "../currency/app-fixture.js";

const { CreditsApp } = await import("../../scripts/currency/credits-app.js");
const { getCreditRecipients } = await import("../../scripts/currency/recipients.js");

test.beforeEach(resetFoundryEnvironment);

test("recipient discovery separates closed owned Stashes from player characters and preserves first-found order", async () => {
  const source = worldCreditActor("source", "8k");
  const first = worldCreditActor("Z shared Stash", "bad", { stash: true, hasPlayerOwner: false });
  worldCreditActor("private Stash", "1k", { stash: true, isOwner: false });
  const player = worldCreditActor("Z player", "bad", { isOwner: false });
  const second = worldCreditActor("A Stash", "2k", { stash: true });
  worldCreditActor("NPC", "1k", { hasPlayerOwner: false });
  worldCreditActor("creature", "1k", { type: "creature" });
  const other = worldCreditActor("A player", "1k");
  const app = new CreditsApp({ actor: source });
  const context = await app._prepareContext();
  assert.deepEqual(context.stashRecipients.map(entry => entry.id), [first.id, second.id]);
  assert.deepEqual(context.transferRecipients.map(entry => entry.id), [player.id, other.id]);
  assert.equal(context.stashRecipients[0].id, first.id);
  first.isOwner = false;
  assert.deepEqual(getCreditRecipients(source).stash.map(entry => entry.id), [second.id]);
  assert.equal(dialogs.length, 0);
  assert.equal(batchWrites.length, 0);
  for (const document of game.actors.contents) assert.deepEqual(document.writes, []);
});
