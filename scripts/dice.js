class ZeroBasedDie extends foundry.dice.terms.Die {
  static FACES = 0;

  static get MAX_VALUE() {
    return this.mapResult(this.FACES - 1);
  }

  constructor(termData = {}) {
    super({ ...termData, faces: new.target.FACES });
  }

  static mapResult(result) {
    return result % this.FACES;
  }

  _applyZeroBasedResults() {
    for (const result of this.results) {
      result.result = this.constructor.mapResult(result.result);
    }
    this._total = this.values.reduce((total, value) => total + value, 0);
  }

  roll(options) {
    const roll = super.roll(options);
    this._applyZeroBasedResults();
    return roll;
  }

  async evaluate(options) {
    const roll = await super.evaluate(options);
    this._applyZeroBasedResults();
    return roll;
  }

  getResultLabel(result) {
    return String(result.result);
  }

  getResultCSS(result) {
    const css = super.getResultCSS(result);
    const classNames = Array.isArray(css)
      ? css.join(" ")
      : typeof css === "string"
        ? css
        : "";
    const value = result.result;
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
  static FACES = 10;

  static mapResult(result) {
    return (result % this.FACES) * 10;
  }
}

class dTDie extends ZeroBasedDie {
  static DENOMINATION = "t";
  static FACES = 10;
}

class dVDie extends ZeroBasedDie {
  static DENOMINATION = "v";
  static FACES = 5;
}

export function registerDiceTerms() {
  if (!globalThis.CONFIG?.Dice?.terms) {
    Hooks.once("setup", registerDiceTerms);
    return;
  }
  CONFIG.Dice.terms.x = dXDie;
  CONFIG.Dice.terms.h = dHDie;
  CONFIG.Dice.terms.t = dTDie;
  CONFIG.Dice.terms.v = dVDie;
}
