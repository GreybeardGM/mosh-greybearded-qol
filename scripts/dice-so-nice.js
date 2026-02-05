const D_0_TO_4_LABELS = ["0","1","2","3","4","0","1","2","3","4"];
const D_0_TO_9_LABELS = ["0","1","2","3","4","5","6","7","8","9"];
const D_00_TO_90_LABELS = ["10","20","30","40","50","60","70","80","90","00"];

function addZeroBasedPreset(dice3d, { type, labels, values, system, shape }) {
  dice3d.addDicePreset(
    {
      type,
      labels,
      values,
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
    addZeroBasedPreset(dice3d, { type: "dx", labels: D_0_TO_9_LABELS, values: {min:0,max:9}, system: system.id, shape: "d10" });
    addZeroBasedPreset(dice3d, { type: "dh", labels: D_00_TO_90_LABELS, values: {min:0,max:99}, system: system.id, shape: "d100" });
    addZeroBasedPreset(dice3d, { type: "dv", labels: D_0_TO_4_LABELS, values: {min:0,max:4}, system: system.id, shape: "d10" });
    
  });
}
