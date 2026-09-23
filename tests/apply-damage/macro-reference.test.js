import test from "node:test";
import assert from "node:assert/strict";

import { buildMoshMacroReference } from "../../scripts/apply-damage/macro-reference.js";
import {
  MOSH_DEATH_SAVE_MACRO_UUID,
  MOSH_WOUND_ROLL_MACRO_UUID
} from "../../scripts/codex/mosh-system.js";

test("macro reference builder links bundled compendium UUIDs independently of the visible label", () => {
  assert.equal(
    buildMoshMacroReference(MOSH_WOUND_ROLL_MACRO_UUID, "Wundwurf"),
    "@UUID[Compendium.mosh.macros_hotbar_1e.ZzKgfEmRdvDfyBMS]{Wundwurf}"
  );
  assert.equal(
    buildMoshMacroReference(MOSH_DEATH_SAVE_MACRO_UUID, "Todeswurf"),
    "@UUID[Compendium.mosh.macros_hotbar_1e.NsRHfRuuNGPfkYVf]{Todeswurf}"
  );
});
