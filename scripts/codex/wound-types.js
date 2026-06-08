import { normalizeText } from "../utils/normalization.js";

const WOUND_TYPES = [
  {
    id: "bluntforce",
    settingKey: "BluntForce",
    tableSettingKey: "table1eWoundBluntForce",
    label: "Blunt Force",
    icon: "fa-solid fa-hammer",
    image: "systems/mosh/images/icons/ui/rolltables/wounds_blunt_force.png"
  },
  {
    id: "bleeding",
    settingKey: "Bleeding",
    tableSettingKey: "table1eWoundBleeding",
    label: "Bleeding",
    icon: "fa-solid fa-droplet",
    image: "systems/mosh/images/icons/ui/rolltables/wounds_bleeding.png"
  },
  {
    id: "gunshot",
    settingKey: "Gunshot",
    tableSettingKey: "table1eWoundGunshot",
    label: "Gunshot",
    icon: "fa-solid fa-gun",
    image: "systems/mosh/images/icons/ui/rolltables/wounds_gunshot.png"
  },
  {
    id: "fireexplosives",
    settingKey: "FireExplosives",
    tableSettingKey: "table1eWoundFireExplosives",
    label: "Fire & Explosives",
    icon: "fa-solid fa-explosion",
    image: "systems/mosh/images/icons/ui/rolltables/wounds_fire_&_explosives.png"
  },
  {
    id: "goremassive",
    settingKey: "GoreMassive",
    tableSettingKey: "table1eWoundGoreMassive",
    label: "Gore & Massive",
    icon: "fa-solid fa-skull",
    image: "systems/mosh/images/icons/ui/rolltables/wounds_gore_&_massive.png"
  }
];

export function getWoundTypeById(id) {
  return WOUND_TYPES.find((woundType) => woundType.id === id) ?? null;
}

export function getWoundTypeBySettingKey(settingKey) {
  return WOUND_TYPES.find((woundType) => woundType.settingKey === settingKey) ?? null;
}


export function getWoundTypeByLabel(label) {
  const normalizedLabel = normalizeWoundTypeText(label);
  return WOUND_TYPES.find((woundType) => normalizeWoundTypeText(woundType.label) === normalizedLabel) ?? null;
}

export function getWoundTypeByTableSettingKey(tableSettingKey) {
  return WOUND_TYPES.find((woundType) => woundType.tableSettingKey === tableSettingKey) ?? null;
}

function normalizeWoundTypeText(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "");
}
