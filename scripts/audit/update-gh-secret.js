#!/usr/bin/env node
/**
 * Update a single GitHub Actions repository secret.
 *
 * Reads the GitHub PAT from `git credential-osxkeychain get`, fetches
 * the repo's encryption public key, encrypts the new secret value
 * with libsodium, and PUTs to /repos/{owner}/{repo}/actions/secrets/{name}.
 *
 * The new value is taken from the env var named in argv[3] so the
 * literal token never appears on the command line or in logs.
 *
 * Usage:
 *   ELFA_API_KEY=elfak_... node scripts/audit/update-gh-secret.js \
 *     USBVadik/TuringVault-Core ELFA_API_KEY ELFA_API_KEY
 *
 * Args:
 *   1. owner/repo
 *   2. secret name on GitHub
 *   3. env var name on this shell whose value is the new secret
 */
const sodium = require("libsodium-wrappers");
const { execSync } = require("child_process");

async function main() {
  const repo = process.argv[2];
  const secretName = process.argv[3];
  const envVarName = process.argv[4];
  if (!repo || !secretName || !envVarName) {
    console.error(
      "Usage: node update-gh-secret.js owner/repo SECRET_NAME ENV_VAR_NAME"
    );
    process.exit(1);
  }
  const value = process.env[envVarName];
  if (!value) {
    console.error(`Env var ${envVarName} is not set`);
    process.exit(1);
  }

  // Pull GH PAT from macOS keychain (already used by git push).
  let pat;
  try {
    const cred = execSync("git credential-osxkeychain get", {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf-8",
    });
    const m = cred.match(/^password=(\S+)/m);
    if (!m) throw new Error("password line missing");
    pat = m[1];
  } catch (e) {
    console.error("Failed to read GH PAT from keychain:", e.message);
    process.exit(1);
  }

  // 1. fetch repo public key
  const pkResp = await fetch(
    `https://api.github.com/repos/${repo}/actions/secrets/public-key`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!pkResp.ok) {
    console.error(`Public-key fetch failed: HTTP ${pkResp.status}`);
    console.error(await pkResp.text());
    process.exit(1);
  }
  const pk = await pkResp.json();

  // 2. encrypt
  await sodium.ready;
  const messageBytes = sodium.from_string(value);
  const keyBytes = sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL);
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
  const encryptedValue = sodium.to_base64(
    encryptedBytes,
    sodium.base64_variants.ORIGINAL
  );

  // 3. PUT
  const putResp = await fetch(
    `https://api.github.com/repos/${repo}/actions/secrets/${secretName}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id: pk.key_id,
      }),
    }
  );
  if (!putResp.ok && putResp.status !== 201 && putResp.status !== 204) {
    console.error(`Secret PUT failed: HTTP ${putResp.status}`);
    console.error(await putResp.text());
    process.exit(1);
  }
  console.log(
    `✅ Updated GitHub Actions secret ${repo}#${secretName} (HTTP ${putResp.status})`
  );
}

main().catch((e) => {
  console.error("FATAL:", e?.message || e);
  process.exit(1);
});
