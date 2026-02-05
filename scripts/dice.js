class ZeroBasedDie extends foundry.dice.terms.Die {
  static FACES = 0;

  static get MAX_VALUE() {
    return this.FACES - 1;
  }

  constructor(termData = {}) {
    super({ ...termData, faces: new.target.FACES });
  }

  static mapResult(result) {
    return result % this.FACES;
  }

  roll(options) {
    const roll = super.roll(options);
    for (const result of this.results) {
      result.result = this.constructor.mapResult(result.result);
    }
    this._total = this.values.reduce((total, value) => total + value, 0);
    return roll;
  }

  getResultLabel(result) {
    return String(this.constructor.mapResult(result.result));
  }

  getResultCSS(result) {
    const css = super.getResultCSS(result);
    const classNames = Array.isArray(css)
      ? css.join(" ")
      : typeof css === "string"
        ? css
        : "";
    const value = this.constructor.mapResult(result.result);
    const classList = new Set(classNames.split(/\s+/).filter(Boolean));

    classList.delete("min");
    classList.delete("max");

    if (value === 0) classList.add("min");
    if (value === this.constructor.MAX_VALUE) classList.add("max");

    return Array.from(classList);
  }

  get values() {
    return this.results.map(result => result.result);
  }

  get total() {
    return this.values.reduce((total, value) => total + value, 0);
  }
}

class dXDie extends ZeroBasedDie {
  static DENOMINATION = "x";
  static FACES = 10;
}

class dHDie extends ZeroBasedDie {
  static DENOMINATION = "h";
  static FACES = 100;
}

class dVDie extends ZeroBasedDie {
  static DENOMINATION = "v";
  static FACES = 10;
  static LABELS = ["0", "0", "1", "1", "2", "2", "3", "3", "4", "4"];

  static get MAX_VALUE() {
    return 4;
  }

  static mapResult(result) {
    if (result <= this.MAX_VALUE) return result;
    return Number(this.LABELS[result - 1]);
  }
}

export function registerDiceTerms() {
  if (!globalThis.CONFIG?.Dice?.terms) {
    Hooks.once("setup", registerDiceTerms);
    return;
  }
  CONFIG.Dice.terms.x = dXDie;
  CONFIG.Dice.terms.h = dHDie;
  CONFIG.Dice.terms.v = dVDie;
}
