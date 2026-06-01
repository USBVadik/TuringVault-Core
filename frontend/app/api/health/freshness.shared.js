function validIsoMs(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function maxIso(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  const aMs = validIsoMs(a);
  const bMs = validIsoMs(b);
  if (aMs === null) return b;
  if (bMs === null) return a;
  return aMs >= bMs ? a : b;
}

function newestOutcomeIso(outcomes) {
  if (!outcomes) return null;
  let newest = null;
  for (const entry of outcomes.pending || []) {
    newest = maxIso(newest, entry && entry.recordedAt);
  }
  for (const entry of outcomes.settled || []) {
    newest = maxIso(
      newest,
      entry && (entry.settledAt || entry.recordedAt)
    );
  }
  return newest;
}

function pickFreshestByIso(localValue, remoteValue, getIso) {
  if (!localValue) return remoteValue || null;
  if (!remoteValue) return localValue || null;

  const localMs = validIsoMs(getIso(localValue));
  const remoteMs = validIsoMs(getIso(remoteValue));
  if (localMs === null && remoteMs === null) return localValue;
  if (localMs === null) return remoteValue;
  if (remoteMs === null) return localValue;
  return remoteMs > localMs ? remoteValue : localValue;
}

function pickFreshestOutcomes(localOutcomes, remoteOutcomes) {
  return pickFreshestByIso(
    localOutcomes,
    remoteOutcomes,
    newestOutcomeIso
  );
}

module.exports = {
  maxIso,
  newestOutcomeIso,
  pickFreshestByIso,
  pickFreshestOutcomes,
};
