const DICE_SO_NICE_SYSTEM = {
  id: "mosh-greybearded-qol",
  name: "MoSh Greybearded QoL"
};

const ZERO_TO_NINE = Array.from({ length: 10 }, (_, index) => String(index));
const ZERO_TO_NINETY_NINE = Array.from({ length: 100 }, (_, index) =>
  String(index).padStart(2, "0")
);
const ZERO_TO_FOUR_DUPLICATED = Array.from({ length: 10 }, (_, index) =>
  String(Math.floor(index / 2))
);

function addZeroBasedPreset(dice3d, { type, labels, term }) {
  dice3d.addDicePreset({
    type,
    labels,
    system: DICE_SO_NICE_SYSTEM.id,
    term
  });
}

export function registerDiceSoNice() {
  Hooks.once("diceSoNiceReady", dice3d => {
    if (!dice3d?.addSystem || !dice3d?.addDicePreset) return;

    dice3d.addSystem(DICE_SO_NICE_SYSTEM, true);

    addZeroBasedPreset(dice3d, {
      type: "d10",
      labels: ZERO_TO_NINE,
      term: "x"
    });

    addZeroBasedPreset(dice3d, {
      type: "d100",
      labels: ZERO_TO_NINETY_NINE,
      term: "c"
    });

    addZeroBasedPreset(dice3d, {
      type: "d10",
      labels: ZERO_TO_FOUR_DUPLICATED,
      term: "v"
    });
  });
}
