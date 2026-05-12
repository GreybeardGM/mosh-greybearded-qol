export const WOUND_TYPES = [
  {
    id: "bluntforce",
    settingKey: "BluntForce",
    label: "Blunt Force",
    icon: "fa-solid fa-hammer",
    image: "systems/mosh/images/icons/ui/rolltables/wounds_blunt_force.png"
  },
  {
    id: "bleeding",
    settingKey: "Bleeding",
    label: "Bleeding",
    icon: "fa-solid fa-droplet",
    image: "systems/mosh/images/icons/ui/rolltables/wounds_bleeding.png"
  },
  {
    id: "gunshot",
    settingKey: "Gunshot",
    label: "Gunshot",
    icon: "fa-solid fa-gun",
    image: "systems/mosh/images/icons/ui/rolltables/wounds_gunshot.png"
  },
  {
    id: "fireexplosives",
    settingKey: "FireExplosives",
    label: "Fire & Explosives",
    icon: "fa-solid fa-explosion",
    image: "systems/mosh/images/icons/ui/rolltables/wounds_fire_&_explosives.png"
  },
  {
    id: "goremassive",
    settingKey: "GoreMassive",
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
