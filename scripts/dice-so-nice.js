const D_0_TO_4 = ["1","2","3","4","0","1","2","3","4","0"];
const D_0_TO_9 = ["1","2","3","4","5","6","7","8","9","0"];
const D_00_TO_90 = ["10","20","30","40","50","60","70","80","90","00"];

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
    addZeroBasedPreset(dice3d, { type: "dx", labels: D_0_TO_9, system: system.id, shape: "d10" });
    addZeroBasedPreset(dice3d, { type: "dh", labels: [D_00_TO_90, D_0_TO_9], system: system.id, shape: "d100" });
    addZeroBasedPreset(dice3d, { type: "dv", labels: D_0_TO_4, system: system.id, shape: "d10" });
    
  });
}
