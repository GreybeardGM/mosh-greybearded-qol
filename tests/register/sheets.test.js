import test from "node:test";
import assert from "node:assert/strict";
import { resetFoundryEnvironment } from "../helpers/foundry-environment.js";
import { worldCreditActor } from "../currency/app-fixture.js";

const { getSheetKind } = await import("../../scripts/register/sheets.js");
const { QoLContractorSheet } = await import("../../scripts/sheets/contractor-sheet-class.js");

test.beforeEach(resetFoundryEnvironment);

test("sheet classification retains native kinds and recognizes Contractor instances and assigned classes", () => {
  const contractor = { type: "creature" };
  assert.equal(getSheetKind(new QoLContractorSheet(contractor)), "contractor");
  for (const sheetClass of ["QoLContractorSheet", "mosh-greybearded-qol.QoLContractorSheet", "OtherSheet", undefined, 123]) {
    const actor = { type: "creature", getFlag: (scope, key) => {
      assert.deepEqual([scope, key], ["core", "sheetClass"]);
      return sheetClass;
    } };
    const expected = typeof sheetClass === "string" && sheetClass.includes("QoLContractorSheet") ? "contractor" : "creature";
    assert.equal(getSheetKind({ actor }), expected);
    assert.equal(getSheetKind(null, actor), expected);
  }
  for (const type of ["character", "ship", "creature"]) assert.equal(getSheetKind({ actor: { type } }), type);
  assert.equal(getSheetKind(), "unknown");
  assert.equal(getSheetKind(worldCreditActor("stash", "1k", { stash: true }).sheet), "stash");
});
