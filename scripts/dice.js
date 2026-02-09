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
      if (result._zeroBasedMapped) continue;
      result.result = this.constructor.mapResult(result.result);
      result._zeroBasedMapped = true;
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
  registerZeroMaxModifier();
  CONFIG.Dice.terms.x = dXDie;
  CONFIG.Dice.terms.h = dHDie;
  CONFIG.Dice.terms.t = dTDie;
  CONFIG.Dice.terms.v = dVDie;
}

function registerZeroMaxModifier() {
  const Die = foundry?.dice?.terms?.Die;
  if (!Die) return;

  Die.MODIFIERS = Die.MODIFIERS || {};

  if (!Die.prototype._zeroMaxPatchedLabel) {
    const originalGetResultLabel = Die.prototype.getResultLabel;
    Die.prototype.getResultLabel = function (result) {
      if (result?._zeroMaxApplied) return "0";
      return originalGetResultLabel.call(this, result);
    };
    Die.prototype._zeroMaxPatchedLabel = true;
  }


  if (!Die.prototype._zeroMaxPatchedCss) {
    const originalGetResultCSS = Die.prototype.getResultCSS;
    Die.prototype.getResultCSS = function (result) {
      const css = originalGetResultCSS.call(this, result);
      const classNames = Array.isArray(css)
        ? css.join(" ")
        : typeof css === "string"
          ? css
          : "";
      const classList = new Set(classNames.split(/\s+/).filter(Boolean));

      const usesZeroMax = Array.isArray(this.modifiers) && this.modifiers.includes("z");
      if (!usesZeroMax) return Array.from(classList);

      classList.delete("min");
      classList.delete("max");

      const max = Number(this.faces);
      const zeroMaxTopValue = max - 1;

      if (result?._zeroMaxApplied) classList.add("min");
      else if (Number.isFinite(zeroMaxTopValue) && result?.result === zeroMaxTopValue) classList.add("max");

      return Array.from(classList);
    };
    Die.prototype._zeroMaxPatchedCss = true;
  }

  if (!Die.prototype._zeroMaxPatchedTotal) {
    const totalDescriptor = Object.getOwnPropertyDescriptor(Die.prototype, "total");
    if (totalDescriptor?.get) {
      const originalGetTotal = totalDescriptor.get;
      Object.defineProperty(Die.prototype, "total", {
        configurable: true,
        enumerable: totalDescriptor.enumerable ?? false,
        get() {
          if (!Array.isArray(this.results)) return originalGetTotal.call(this);
          return this.results.reduce((sum, result) => {
            if (!result?.active) return sum;
            const value = result._zeroMaxApplied ? 0 : Number(result.result);
            return Number.isFinite(value) ? sum + value : sum;
          }, 0);
        }
      });
      Die.prototype._zeroMaxPatchedTotal = true;
    }
  }

  if (!Die.MODIFIERS.z) Die.MODIFIERS.z = "zeroMax";
  if (Die.prototype._zeroMaxPatchedModifier) return;

  Die.prototype.zeroMax = function () {
    const max = Number(this.faces);
    if (!Number.isFinite(max) || max <= 0) return false;

    let changed = false;
    for (const result of this.results) {
      if (!result?.active || result.result !== max) continue;
      result._zeroMaxApplied = true;
      changed = true;
    }

    if (changed) this._total = this.total;
    return changed;
  };

  Die.prototype._zeroMaxPatchedModifier = true;
}
