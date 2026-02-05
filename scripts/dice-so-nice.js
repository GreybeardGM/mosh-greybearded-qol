const ZERO_TO_NINE = Array.from({ length: 10 }, (_, index) => String(index));
const ZERO_TO_NINETY_NINE = Array.from({ length: 100 }, (_, index) =>
  String(index).padStart(2, "0")
);
const ZERO_TO_FOUR_DUPLICATED = Array.from({ length: 10 }, (_, index) =>
  String(Math.floor(index / 2))
);

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

    const systems = new Map();
    if (game?.system?.id) {
      systems.set(game.system.id, {
        id: game.system.id,
        name: game.system.title ?? game.system.id
      });
    }
    systems.set(DICE_SO_NICE_SYSTEM.id, DICE_SO_NICE_SYSTEM);

    for (const system of systems.values()) {
      dice3d.addSystem(system, true);

      addZeroBasedPreset(dice3d, {
        type: "x",
        labels: ZERO_TO_NINE,
        system: system.id,
        shape: "d10"
      });

      addZeroBasedPreset(dice3d, {
        type: "h",
        labels: ZERO_TO_NINETY_NINE,
        system: system.id,
        shape: "d100"
      });

      addZeroBasedPreset(dice3d, {
        type: "v",
        labels: ZERO_TO_FOUR_DUPLICATED,
        system: system.id,
        shape: "d10"
      });
    }
  });
}
