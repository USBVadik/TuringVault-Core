#!/usr/bin/env node
/**
 * Decode a JWT (no verification) and print expiry. Reads token from
 * env var name in argv[2]; never echoes the token itself, only meta.
 *
 * Usage: node scripts/audit/decode-jwt.js PINATA_JWT
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const name = process.argv[2];
if (!name) {
  console.error("Usage: node decode-jwt.js <ENV_VAR_NAME>");
  process.exit(1);
}
const v = process.env[name];
if (!v) {
  console.error(`${name} not set`);
  process.exit(1);
}
const parts = v.split(".");
console.log(`${name}: tokenLen=${v.length} parts=${parts.length}`);
if (parts.length !== 3) {
  console.log("not a 3-part JWT, skipping payload decode");
  process.exit(0);
}
const decode = (p) => JSON.parse(Buffer.from(p, "base64").toString("utf-8"));
try {
  const payload = decode(parts[1]);
  for (const k of ["iat", "exp", "nbf"]) {
    if (typeof payload[k] === "number") {
      console.log(`  ${k}: ${payload[k]} = ${new Date(payload[k] * 1000).toISOString()}`);
    }
  }
  for (const k of ["sub", "scope", "userInformation", "issuer", "iss"]) {
    if (payload[k] !== undefined) {
      const v2 = typeof payload[k] === "object" ? JSON.stringify(payload[k]).slice(0, 100) : String(payload[k]).slice(0, 100);
      console.log(`  ${k}: ${v2}`);
    }
  }
  if (typeof payload.exp === "number") {
    const days = (payload.exp * 1000 - Date.now()) / 86400000;
    console.log(`  expires in: ${days.toFixed(1)} days`);
  } else {
    console.log("  expires in: NEVER (no exp claim)");
  }
} catch (e) {
  console.error("decode failed:", e.message);
}
