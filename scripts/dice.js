export function registerDiceTerms() {
  if (!globalThis.CONFIG?.Dice?.terms) {
    Hooks.once("setup", registerDiceTerms);
    return;
  }
  registerZeroMaxModifier();
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
          const usesZeroMax = Array.isArray(this.modifiers) && this.modifiers.includes("z");
          if (!usesZeroMax) return originalGetTotal.call(this);

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
