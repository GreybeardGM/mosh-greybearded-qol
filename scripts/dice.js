class dXDie extends Die {
  static DENOMINATION = "x";

  constructor(termData = {}) {
    super({ ...termData, faces: 10 });
  }

  static map10to09(result) {
    return result % 10;
  }

  roll(options) {
    const roll = super.roll(options);
    for (const result of this.results) {
      result.result = dXDie.map10to09(result.result);
    }
    return roll;
  }

  getResultLabel(result) {
    return String(dXDie.map10to09(result.result));
  }

  getResultCSS(result) {
    const css = super.getResultCSS(result);
    const classNames = Array.isArray(css)
      ? css.join(" ")
      : typeof css === "string"
        ? css
        : "";
    const value = dXDie.map10to09(result.result);
    const classList = new Set(classNames.split(/\s+/).filter(Boolean));

    classList.delete("min");
    classList.delete("max");

    if (value === 0) classList.add("min");
    if (value === 9) classList.add("max");

    return Array.from(classList);
  }

  get values() {
    return this.results.map(result => result.result);
  }

  get total() {
    return this.values.reduce((total, value) => total + value, 0);
  }
}

class dCDie extends Die {
  static DENOMINATION = "c";

  constructor(termData = {}) {
    super({ ...termData, faces: 100 });
  }

  static map100to099(result) {
    return result % 100;
  }

  roll(options) {
    const roll = super.roll(options);
    for (const result of this.results) {
      result.result = dCDie.map100to099(result.result);
    }
    return roll;
  }

  getResultLabel(result) {
    return String(dCDie.map100to099(result.result));
  }

  getResultCSS(result) {
    const css = super.getResultCSS(result);
    const classNames = Array.isArray(css)
      ? css.join(" ")
      : typeof css === "string"
        ? css
        : "";
    const value = dCDie.map100to099(result.result);
    const classList = new Set(classNames.split(/\s+/).filter(Boolean));

    classList.delete("min");
    classList.delete("max");

    if (value === 0) classList.add("min");
    if (value === 99) classList.add("max");

    return Array.from(classList);
  }

  get values() {
    return this.results.map(result => result.result);
  }

  get total() {
    return this.values.reduce((total, value) => total + value, 0);
  }
}

export function registerDiceTerms() {
  if (!globalThis.CONFIG?.Dice?.terms) return;
  CONFIG.Dice.terms.x = dXDie;
  CONFIG.Dice.terms.c = dCDie;
}
