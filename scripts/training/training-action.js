import { FLAG_TRAINING_SKILL, MODULE_ID } from "../codex/constants.js";
import { MOSH_ITEM_TYPE_SKILL } from "../codex/mosh-system.js";
import { toEmbeddedItemData } from "../character-creator/utils.js";
import { getNormalizedTrainingConfig } from "../settings/training-config.js";
import { loadAllItemsByType } from "../utils/item-loader.js";
import { capitalize, normalizeNumber, normalizeText } from "../utils/normalization.js";
import { TRAINING_SELECTED_SKILL_PATH, TRAINING_XP_VALUE_PATH } from "./constants.js";
import { TrainingSkillSelectorApp } from "./select-training-skill.js";

const TRAINING_XP_REQUIREMENTS = Object.freeze({ trained: 5, expert: 10, master: 15 });

async function findTrainingSkillByName(skillName) {
  const normalizedSkillName = normalizeText(skillName);
  const skills = await loadAllItemsByType(MOSH_ITEM_TYPE_SKILL);
  const match = skills.find(skill => normalizeText(skill?.name) === normalizedSkillName);
  if (!match) return null;

  const skill = match.uuid ? await fromUuid(match.uuid) : match;
  return skill?.type === MOSH_ITEM_TYPE_SKILL ? skill : null;
}

async function progressStoredSkillTraining(actor, skillName, currentXp, xpRequired) {
  const xpValue = currentXp + 1;
  await actor.update({ [TRAINING_XP_VALUE_PATH]: xpValue });
  ui.notifications?.info?.(game.i18n.format("MoshQoL.Training.Progressed", {
    actorName: actor.name,
    skillName,
    xpValue,
    xpRequired
  }));
  return xpValue;
}

async function completeStoredSkillTraining(actor, skill) {
  const itemData = toEmbeddedItemData(skill);
  if (!itemData) return null;

  const [created] = await actor.createEmbeddedDocuments("Item", [itemData]);
  await actor.update({
    [TRAINING_SELECTED_SKILL_PATH]: "",
    [TRAINING_XP_VALUE_PATH]: 0
  });
  await actor.unsetFlag(MODULE_ID, FLAG_TRAINING_SKILL);
  return created;
}

async function handleStoredSkillTraining(actor, selectedSkillName, { advanceXp = false } = {}) {
  const currentXp = normalizeNumber(foundry.utils.getProperty(actor, TRAINING_XP_VALUE_PATH), { fallback: 0 });
  const skill = await findTrainingSkillByName(selectedSkillName);
  if (!skill) {
    ui.notifications?.warn(game.i18n.format("MoshQoL.Training.SkillNotFound", {
      skillName: selectedSkillName
    }));
    if (advanceXp) await progressStoredSkillTraining(actor, selectedSkillName, currentXp, "—");
    return null;
  }

  const rank = normalizeText(skill.system?.rank);
  const requiredXp = TRAINING_XP_REQUIREMENTS[rank];
  const xpValue = advanceXp
    ? await progressStoredSkillTraining(actor, skill.name, currentXp, requiredXp ?? "—")
    : currentXp;

  if (requiredXp !== undefined && xpValue >= requiredXp) {
    return completeStoredSkillTraining(actor, skill);
  }

  if (!advanceXp && requiredXp !== undefined) {
    ui.notifications?.warn(game.i18n.format("MoshQoL.Training.NotEnoughXp", {
      rankLabel: capitalize(rank, { lowerRest: true }),
      skillName: skill.name
    }));
  }

  return null;
}

async function runTrainingForActor(actor) {
  if (!actor) return null;

  const trainingConfig = getNormalizedTrainingConfig();
  const selectedSkillName = String(foundry.utils.getProperty(actor, TRAINING_SELECTED_SKILL_PATH) ?? "").trim();
  const trainedSkill = trainingConfig.useSkillTraining && selectedSkillName
    ? await handleStoredSkillTraining(actor, selectedSkillName, {
      advanceXp: trainingConfig.autoTrainAfterShoreLeave
    })
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

export function scheduleAutoTrainingAfterShoreLeave(actor) {
  if (!getNormalizedTrainingConfig().autoTrainAfterShoreLeave) return;

  setTimeout(() => {
    void runTrainingForActor(actor).catch(error => console.error(error));
  }, 0);
}
