export const SHORE_LEAVE_TIERS = [
  {
    tier: "X",
    label: "X-Class",
    icon: "fa-x",
    baseStressConversion: {
      dice: 2,
      faces: 10,
      keep: "+",
      bonus: 0,
      multiplier: 1
    },
    basePrice: {
      dice: 1,
      faces: 100,
      keep: null,
      bonus: 0,
      multiplier: 10000
    }
  },
  {
    tier: "C",
    label: "C-Class",
    icon: "fa-c",
    baseStressConversion: {
      dice: 1,
      faces: 5,
      keep: null,
      bonus: 0,
      multiplier: 1
    },
    basePrice: {
      dice: 2,
      faces: 10,
      keep: null,
      bonus: 0,
      multiplier: 100
    }
  },
  {
    tier: "B",
    label: "B-Class",
    icon: "fa-b",
    baseStressConversion: {
      dice: 1,
      faces: 10,
      keep: null,
      bonus: 0,
      multiplier: 1
    },
    basePrice: {
      dice: 2,
      faces: 10,
      keep: null,
      bonus: 0,
      multiplier: 1000
    }
  },
  {
    tier: "A",
    label: "A-Class",
    icon: "fa-a",
    baseStressConversion: {
      dice: 2,
      faces: 10,
      keep: null,
      bonus: 0,
      multiplier: 1
    },
    basePrice: {
      dice: 2,
      faces: 10,
      keep: null,
      bonus: 0,
      multiplier: 10000
    }
  },
  {
    tier: "S",
    label: "S-Class",
    icon: "fa-s",
    baseStressConversion: {
      dice: 0,
      faces: 0,
      keep: null,
      bonus: 20,
      multiplier: 1
    },
    basePrice: {
      dice: 2,
      faces: 10,
      keep: null,
      bonus: 0,
      multiplier: 100000
    }
  }
];
