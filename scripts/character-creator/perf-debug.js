const PERF_TOGGLE_KEY = "__MOSH_QOL_SKILLTREE_PERF__";

function perfApi() {
  if (typeof globalThis === "undefined") return null;
  return globalThis.performance ?? null;
}

export function isSkillTreePerfDebugEnabled() {
  if (typeof globalThis === "undefined") return false;
  return globalThis[PERF_TOGGLE_KEY] === true;
}

export function markSkillTreePerf(name) {
  if (!isSkillTreePerfDebugEnabled()) return;
  const perf = perfApi();
  perf?.mark?.(name);
}

export function measureSkillTreePerf(name, startMark, endMark) {
  if (!isSkillTreePerfDebugEnabled()) return;
  const perf = perfApi();
  if (!perf?.measure) return;

  try {
    perf.measure(name, startMark, endMark);
    const entries = perf.getEntriesByName(name);
    const last = entries.at(-1);
    if (!last) return;

    console.debug(
      `[mosh-greybearded-qol][perf] ${name}: ${last.duration.toFixed(2)}ms`
    );
  } catch (error) {
    console.debug(`[mosh-greybearded-qol][perf] Failed measuring ${name}:`, error);
  } finally {
    perf.clearMarks?.(startMark);
    perf.clearMarks?.(endMark);
    perf.clearMeasures?.(name);
  }
}

export function skillTreePerfDebugHintOnce() {
  if (typeof globalThis === "undefined") return;
  if (!isSkillTreePerfDebugEnabled()) return;
  if (globalThis.__MOSH_QOL_SKILLTREE_PERF_HINT_SHOWN__) return;

  globalThis.__MOSH_QOL_SKILLTREE_PERF_HINT_SHOWN__ = true;
  console.info(
    "[mosh-greybearded-qol][perf] Skill tree perf debug enabled. Toggle with window.__MOSH_QOL_SKILLTREE_PERF__ = true/false"
  );
}
