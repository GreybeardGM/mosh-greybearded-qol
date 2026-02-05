const ZERO_TO_NINE = Array.from({ length: 10 }, (_, index) => String(index));
const ZERO_TO_NINETY_NINE = Array.from({ length: 100 }, (_, index) =>
  String(index).padStart(2, "0")
);
const ZERO_TO_FOUR_DUPLICATED = Array.from({ length: 10 }, (_, index) =>
  String(Math.floor(index / 2))
);
const DV_0_TO_4 = ["1","2","3","4","0"];
const DX_0_TO_9 = ["1","2","3","4","5","6","7","8","9","0"];

function addZeroBasedPreset(dice3d, { type, labels, system, shape }) {
  dice3d.addDicePreset(
    {
      type,
      labels,
      system
    },
    shape
  );
}

export function registerDiceSoNice() {
  Hooks.once("diceSoNiceReady", dice3d => {
    if (!dice3d?.addSystem || !dice3d?.addDicePreset) return;

    const system = {
      id: "mosh-greybearded-qol",
      name: "MoSh Greybearded QoL"
    };

    dice3d.addSystem(system, true);

    // scripts/dice-so-nice.js
    addZeroBasedPreset(dice3d, { type: "dx", labels: DX_0_TO_9, system: system.id, shape: "d10" });
    addZeroBasedPreset(dice3d, { type: "dh", labels: DX_0_TO_9, system: system.id, shape: "d100" });
    addZeroBasedPreset(dice3d, { type: "dv", labels: DV_0_TO_4, system: system.id, shape: "d10" });
    
  });
}
