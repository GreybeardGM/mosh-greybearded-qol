export const ARMOR_COVER_VALUES = {
  none: {
    armor: 0,
    damageReduction: 0
  },
  insignificant: {
    armor: 5,
    damageReduction: 0
  },
  light: {
    armor: 10,
    damageReduction: 0
  },
  heavy: {
    armor: 20,
    damageReduction: 5
  }
};

export function getArmorCoverValues(cover) {
  const normalizedCover = String(cover ?? "none").trim().toLowerCase();
  return ARMOR_COVER_VALUES[normalizedCover] ?? ARMOR_COVER_VALUES.none;
}
