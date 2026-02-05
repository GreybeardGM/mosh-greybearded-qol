class ZeroBasedDie extends foundry.dice.terms.Die {
  static FACES = 0;

  constructor(termData = {}) {
    const faces = termData.faces ?? new.target.FACES;
    super({ ...termData, faces });
  }

  get maxValue() {
    return this.faces - 1;
  }

  mapResult(result) {
    return result;
  }

  roll({ minimize = false, maximize = false } = {}) {
    const faces = this.faces;
    const value = maximize
      ? faces - 1
      : minimize
        ? 0
        : Math.floor(CONFIG.Dice.randomUniform() * faces);

    this.results.push({
      result: value,
      active: true
    });

    return this;
  }

  getResultLabel(result) {
    return String(this.mapResult(result.result));
  }

  getResultCSS(result) {
    const css = super.getResultCSS(result);
    const classNames = Array.isArray(css)
      ? css.join(" ")
      : typeof css === "string"
        ? css
        : "";
    const value = this.mapResult(result.result);
    const classList = new Set(classNames.split(/\s+/).filter(Boolean));

    classList.delete("min");
    classList.delete("max");

    if (value === 0) classList.add("min");
    if (value === this.maxValue) classList.add("max");

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

class dCDie extends ZeroBasedDie {
  static DENOMINATION = "h";
  static FACES = 100;
}

class dVDie extends ZeroBasedDie {
  static DENOMINATION = "v";
  static FACES = 10;
  static LABELS = ["0", "0", "1", "1", "2", "2", "3", "3", "4", "4"];

  get maxValue() {
    return 4;
  }

  roll({ minimize = false, maximize = false } = {}) {
    const faces = this.faces;
    const index = maximize
      ? faces - 1
      : minimize
        ? 0
        : Math.floor(CONFIG.Dice.randomUniform() * faces);

    this.results.push({
      result: Number(this.constructor.LABELS[index]),
      active: true
    });

    return this;
  }
}

export function registerDiceTerms() {
  if (!globalThis.CONFIG?.Dice?.terms) return;
  CONFIG.Dice.terms.x = dXDie;
  CONFIG.Dice.terms.h = dCDie;
  CONFIG.Dice.terms.v = dVDie;
}
