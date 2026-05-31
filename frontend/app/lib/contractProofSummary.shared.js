function isLegacyContract(contract) {
  const name = String(contract?.name || "").toLowerCase();
  const role = String(contract?.role || "").toLowerCase();
  return name.includes("legacy") || role.includes("legacy");
}

function isSourcifyVerified(contract) {
  const status = String(contract?.sourcify || "").toLowerCase();
  return status === "full" || status === "perfect" || status === "exact_match";
}

function summarizeSourcifyContracts(contracts) {
  const current = Array.isArray(contracts)
    ? contracts.filter((contract) => !isLegacyContract(contract))
    : [];
  const total = current.length;
  const verified = current.filter(isSourcifyVerified).length;

  return {
    total,
    verified,
    detail: `${total} contracts · ${verified}/${total} Sourcify-verified`,
  };
}

module.exports = {
  isLegacyContract,
  isSourcifyVerified,
  summarizeSourcifyContracts,
};
