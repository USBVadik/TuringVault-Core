function shouldRunDashboardPoll(doc) {
  if (!doc || typeof doc.visibilityState !== "string") return true;
  return doc.visibilityState !== "hidden";
}

module.exports = {
  shouldRunDashboardPoll,
};
