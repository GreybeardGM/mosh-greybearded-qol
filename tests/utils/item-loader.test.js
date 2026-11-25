import test from "node:test";
import assert from "node:assert/strict";
import { loadAllItemsByType } from "../../scripts/utils/item-loader.js";

const hooks = new Map();
globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
let items, worldReads;
globalThis.game = { packs: [], get items() { worldReads += 1; return items; } };
const item = (type, name) => ({ type, name });
test.beforeEach(() => {
  hooks.get("updateItem")?.();
  worldReads = 0;
  items = [item("skill", "Piloting"), item("class", "Marine"), item("weapon", "Pistol")];
});

test("Skill and Class caches persist independently and return separate result arrays", async () => {
  const skills = await loadAllItemsByType("skill");
  await loadAllItemsByType("class");
  skills.pop();
  assert.equal((await loadAllItemsByType("skill")).length, 1);
  assert.equal((await loadAllItemsByType("class")).length, 1);
  assert.equal(worldReads, 2);
  await loadAllItemsByType("weapon");
  await loadAllItemsByType("weapon");
  assert.equal(worldReads, 4); // Equipment is not retained in the type-result cache.
});

test("the type cache still rejects results above its per-type item limit", async () => {
  items = Array.from({ length: 251 }, (_, index) => item("skill", `Custom ${index}`));
  assert.equal((await loadAllItemsByType("skill")).length, 251);
  assert.equal((await loadAllItemsByType("skill")).length, 251);
  assert.equal(worldReads, 2);
});

test("item and compendium changes invalidate cached results", async () => {
  for (const hook of ["createItem", "updateItem", "deleteItem", "createCompendium", "deleteCompendium"]) {
    await loadAllItemsByType("skill");
    items = [item("skill", hook)];
    hooks.get(hook)();
    assert.deepEqual((await loadAllItemsByType("skill")).map(entry => entry.name), [hook]);
  }
});
