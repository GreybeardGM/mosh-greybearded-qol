import { FLAG_TRAINING_SKILL, MODULE_ID } from "../codex/constants.js";
import { toEmbeddedItemData } from "../character-creator/utils.js";
import { getNormalizedTrainingConfig } from "../settings/training-config.js";
import { loadAllItemsByType } from "../utils/item-loader.js";
import { normalizeNumber, normalizeText } from "../utils/normalization.js";
import { TrainingSkillSelectorApp } from "./select-training-skill.js";

const TRAINING_XP_REQUIREMENTS = Object.freeze({ trained: 5, expert: 10, master: 15 });

async function findTrainingSkillByName(skillName) {
  const normalizedSkillName = normalizeText(skillName);
  const skills = await loadAllItemsByType("skill");
  const match = skills.find(skill => normalizeText(skill?.name) === normalizedSkillName);
  if (!match) return null;

  const skill = match.uuid ? await fromUuid(match.uuid) : match;
  return skill?.type === "skill" ? skill : null;
}

async function completeStoredSkillTraining(actor, skill) {
  const itemData = toEmbeddedItemData(skill);
  if (!itemData) return null;

  const [created] = await actor.createEmbeddedDocuments("Item", [itemData]);
  await actor.update({
    "system.xp.selectedSkill": "",
    "system.xp.value": 0
  });
  await actor.unsetFlag(MODULE_ID, FLAG_TRAINING_SKILL);
  return created;
}

async function handleStoredSkillTraining(actor, selectedSkillName) {
  const skill = await findTrainingSkillByName(selectedSkillName);
  if (!skill) {
    ui.notifications?.warn(game.i18n.format("MoshQoL.Training.SkillNotFound", {
      skillName: selectedSkillName
    }));
    return null;
  }

  const requiredXp = TRAINING_XP_REQUIREMENTS[normalizeText(skill.system?.rank)];
  const currentXp = normalizeNumber(actor.system?.xp?.value, { fallback: 0 });

  if (requiredXp !== undefined && currentXp >= requiredXp) {
    return completeStoredSkillTraining(actor, skill);
  }

  await actor.update({ "system.xp.value": currentXp + 1 });
  ui.notifications?.info?.(game.i18n.format("MoshQoL.Training.Progressed", {
    actorName: actor.name,
    skillName: skill.name,
    xpValue: currentXp + 1,
    xpRequired: requiredXp ?? "—"
  }));
  return null;
}

async function runTrainingForActor(actor) {
  if (!actor) return null;

  const selectedSkillName = String(actor.system?.xp?.selectedSkill ?? "").trim();
  const trainedSkill = getNormalizedTrainingConfig().useSkillTraining && selectedSkillName
    ? await handleStoredSkillTraining(actor, selectedSkillName)
    : await TrainingSkillSelectorApp.wait({ actor });
  if (!trainedSkill) return null;

  ui.notifications?.info?.(game.i18n.format("MoshQoL.Training.Learned", {
    actorName: actor.name,
    skillName: trainedSkill.name
  }));
  return trainedSkill;
}

export async function handleTrainingAction(sheet) {
  const trainedSkill = await runTrainingForActor(sheet?.actor);
  if (!trainedSkill) return sheet?.render(false);

  return sheet.render(false);
}

async function runAutoTrainingAfterShoreLeave(actor) {
  if (!getNormalizedTrainingConfig().autoTrainAfterShoreLeave) return null;

  return runTrainingForActor(actor);
}

export function scheduleAutoTrainingAfterShoreLeave(actor) {
  setTimeout(() => {
    void runAutoTrainingAfterShoreLeave(actor).catch(error => console.error(error));
  }, 0);
}
