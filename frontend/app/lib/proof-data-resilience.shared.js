function fulfilledValue(settled, fallback) {
  if (settled && settled.status === "fulfilled") {
    return settled.value;
  }
  return fallback;
}

module.exports = { fulfilledValue };
