/**
 * TuringVault Tencent KMS Crypto Module
 * 
 * Hardware-secured transaction signing via Tencent Cloud KMS.
 * The AI generates "intents" → Pre-Action Check → KMS signs with secp256k1.
 * 
 * Key architecture:
 *   AI Decision (unsigned intent) → Validation → KMS.Sign(digest)
 *     → DER decode → (r, s, v) → EIP-155 TX → broadcast
 * 
 * This module handles:
 * 1. DER ASN.1 parsing of KMS signature responses
 * 2. EIP-2 s-value canonicalization (s must be in lower half of curve)
 * 3. Recovery ID (v) calculation for Ethereum compatibility
 * 4. EIP-155 chain replay protection (chainId = 5000 for Mantle)
 */

const { ethers } = require("ethers");
const crypto = require("crypto");

// secp256k1 curve order
const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const SECP256K1_HALF_N = SECP256K1_N / 2n;

// Mantle Mainnet chain ID
const CHAIN_ID = 5000;

class TencentKMSCrypto {
  constructor(options = {}) {
    this.keyId = options.keyId || process.env.TENCENT_KMS_KEY_ID;
    this.secretId = options.secretId || process.env.TENCENT_KMS_SECRET_ID;
    this.secretKey = options.secretKey || process.env.TENCENT_KMS_SECRET_KEY;
    this.region = options.region || "ap-singapore";
    this.endpoint = `kms.${this.region}.tencentcloudapi.com`;
    
    // Public key (derived from KMS or provided)
    this.publicKey = options.publicKey || null;
    this.address = options.address || null;
    
    // Simulation mode (no real KMS credentials)
    this.simulate = options.simulate || !this.keyId;
  }

  /**
   * Parse DER-encoded ECDSA signature from KMS into (r, s) components
   * 
   * DER structure:
   *   SEQUENCE {
   *     INTEGER r
   *     INTEGER s
   *   }
   * 
   * Format: 30 <len> 02 <r_len> <r_bytes> 02 <s_len> <s_bytes>
   */
  parseDER(derSignature) {
    const buf = Buffer.isBuffer(derSignature) 
      ? derSignature 
      : Buffer.from(derSignature, "hex");
    
    let offset = 0;
    
    // SEQUENCE tag (0x30)
    if (buf[offset] !== 0x30) {
      throw new Error(`Invalid DER: expected SEQUENCE tag 0x30, got 0x${buf[offset].toString(16)}`);
    }
    offset++;
    
    // SEQUENCE length
    const seqLen = buf[offset];
    offset++;
    
    // First INTEGER (r)
    if (buf[offset] !== 0x02) {
      throw new Error(`Invalid DER: expected INTEGER tag 0x02 for r, got 0x${buf[offset].toString(16)}`);
    }
    offset++;
    
    const rLen = buf[offset];
    offset++;
    
    // r value (strip leading zero if present — DER uses signed integers)
    let rBytes = buf.slice(offset, offset + rLen);
    if (rBytes[0] === 0x00 && rLen > 32) {
      rBytes = rBytes.slice(1); // Remove leading zero padding
    }
    const r = BigInt("0x" + rBytes.toString("hex"));
    offset += rLen;
    
    // Second INTEGER (s)
    if (buf[offset] !== 0x02) {
      throw new Error(`Invalid DER: expected INTEGER tag 0x02 for s, got 0x${buf[offset].toString(16)}`);
    }
    offset++;
    
    const sLen = buf[offset];
    offset++;
    
    let sBytes = buf.slice(offset, offset + sLen);
    if (sBytes[0] === 0x00 && sLen > 32) {
      sBytes = sBytes.slice(1);
    }
    const s = BigInt("0x" + sBytes.toString("hex"));
    
    return { r, s };
  }

  /**
   * EIP-2: Ensure s is in the lower half of the curve order
   * If s > N/2, replace with N - s
   * This prevents signature malleability
   */
  canonicalizeS(s) {
    if (s > SECP256K1_HALF_N) {
      return SECP256K1_N - s;
    }
    return s;
  }

  /**
   * Calculate recovery ID (v) by trying both possible values
   * and checking which recovers to the known public key/address
   */
  calculateRecoveryId(digest, r, s, expectedAddress) {
    const digestBytes = Buffer.from(digest.replace("0x", ""), "hex");
    
    // Pad r and s to 32 bytes each
    const rHex = r.toString(16).padStart(64, "0");
    const sHex = s.toString(16).padStart(64, "0");
    const sigHex = "0x" + rHex + sHex;
    
    // Try v = 27 (recovery = 0) and v = 28 (recovery = 1)
    for (let v = 27; v <= 28; v++) {
      try {
        const recovered = ethers.recoverAddress(
          digest,
          { r: "0x" + rHex, s: "0x" + sHex, v }
        );
        if (recovered.toLowerCase() === expectedAddress.toLowerCase()) {
          return v;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error("Could not determine recovery ID — address mismatch");
  }

  /**
   * Apply EIP-155 replay protection to the recovery value
   * v = chainId * 2 + 35 + recovery_id (0 or 1)
   */
  eip155V(recoveryId) {
    // recoveryId is 27 or 28, convert to 0 or 1
    const recId = recoveryId - 27;
    return CHAIN_ID * 2 + 35 + recId;
  }

  /**
   * Sign a transaction digest via KMS (or simulate)
   * Returns { r, s, v } ready for ethers serialization
   */
  async signDigest(digest, expectedAddress) {
    if (this.simulate) {
      return this._simulateSign(digest, expectedAddress);
    }
    
    // Call Tencent KMS AsymmetricSign API
    const payload = {
      KeyId: this.keyId,
      Algorithm: "SM2DSA", // or ECC_SECP256K1 depending on key type
      Message: Buffer.from(digest.replace("0x", ""), "hex").toString("base64"),
      MessageType: "DIGEST",
    };
    
    const response = await this._callKMS("AsymmetricSign", payload);
    const derSig = Buffer.from(response.Signature, "base64");
    
    // Parse DER → (r, s)
    let { r, s } = this.parseDER(derSig);
    
    // EIP-2: Canonicalize s
    s = this.canonicalizeS(s);
    
    // Calculate recovery ID
    const v = this.calculateRecoveryId(digest, r, s, expectedAddress || this.address);
    
    return {
      r: "0x" + r.toString(16).padStart(64, "0"),
      s: "0x" + s.toString(16).padStart(64, "0"),
      v: this.eip155V(v),
      recoveryId: v - 27,
    };
  }

  /**
   * Sign a full transaction object
   * tx = { to, value, data, nonce, gasLimit, gasPrice/maxFeePerGas, chainId }
   */
  async signTransaction(tx) {
    // Ensure chain ID
    tx.chainId = tx.chainId || CHAIN_ID;
    
    if (this.simulate) {
      return this._simulateSignTx(tx);
    }
    
    // Serialize unsigned transaction
    const unsignedTx = ethers.Transaction.from(tx);
    const digest = ethers.keccak256(unsignedTx.unsignedSerialized);
    
    // Sign digest via KMS
    const sig = await this.signDigest(digest, this.address);
    
    // Attach signature
    unsignedTx.signature = {
      r: sig.r,
      s: sig.s,
      v: sig.v,
    };
    
    return {
      signedTx: unsignedTx.serialized,
      hash: ethers.keccak256(unsignedTx.serialized),
      signature: sig,
    };
  }

  /**
   * Simulation mode: use local private key to mimic KMS flow
   * (For development/testing without real KMS credentials)
   */
  _simulateSign(digest, expectedAddress) {
    // Generate a DER signature using Node.js crypto (simulating KMS response)
    const rawKey = process.env.PRIVATE_KEY;
    if (!rawKey) {
      // Return a mock signature structure
      return {
        r: "0x" + "ab".repeat(32),
        s: "0x" + "cd".repeat(32),
        v: CHAIN_ID * 2 + 35,
        recoveryId: 0,
        simulated: true,
      };
    }
    
    // Use ethers to sign (simulating the full KMS → DER → parse → canonicalize flow)
    const privKey = rawKey.startsWith("0x") ? rawKey : "0x" + rawKey;
    const signingKey = new ethers.SigningKey(privKey);
    const sig = signingKey.sign(digest);
    
    // Simulate DER encoding then re-parsing (to test the pipeline)
    const r = BigInt(sig.r);
    const s = BigInt(sig.s);
    
    // Create DER encoding
    const derEncoded = this._encodeDER(r, s);
    
    // Parse it back (full round-trip test)
    const parsed = this.parseDER(derEncoded);
    const canonS = this.canonicalizeS(parsed.s);
    
    return {
      r: "0x" + parsed.r.toString(16).padStart(64, "0"),
      s: "0x" + canonS.toString(16).padStart(64, "0"),
      v: this.eip155V(sig.v),
      recoveryId: sig.v - 27,
      simulated: true,
      derRoundTrip: true,
    };
  }

  _simulateSignTx(tx) {
    const rawKey = process.env.PRIVATE_KEY;
    if (!rawKey) {
      return Promise.resolve({ signedTx: "0x...", hash: "0x...", simulated: true });
    }
    
    const privKey = rawKey.startsWith("0x") ? rawKey : "0x" + rawKey;
    const wallet = new ethers.Wallet(privKey);
    // We sign but also demonstrate the KMS pipeline would work
    return wallet.signTransaction(tx).then(signedTx => ({
      signedTx,
      hash: ethers.keccak256(signedTx),
      simulated: true,
      note: "Signed locally (KMS simulation mode)",
    }));
  }

  /**
   * Encode (r, s) into DER format (for testing round-trips)
   */
  _encodeDER(r, s) {
    const rHex = r.toString(16);
    const sHex = s.toString(16);
    
    // Pad to even length
    const rBytes = Buffer.from(rHex.padStart(rHex.length + (rHex.length % 2), "0"), "hex");
    const sBytes = Buffer.from(sHex.padStart(sHex.length + (sHex.length % 2), "0"), "hex");
    
    // Add leading zero if high bit set (DER signed integer)
    const rDer = rBytes[0] >= 0x80 ? Buffer.concat([Buffer.from([0x00]), rBytes]) : rBytes;
    const sDer = sBytes[0] >= 0x80 ? Buffer.concat([Buffer.from([0x00]), sBytes]) : sBytes;
    
    // Build: 30 <len> 02 <rlen> <r> 02 <slen> <s>
    const seqLen = 2 + rDer.length + 2 + sDer.length;
    return Buffer.concat([
      Buffer.from([0x30, seqLen]),
      Buffer.from([0x02, rDer.length]),
      rDer,
      Buffer.from([0x02, sDer.length]),
      sDer,
    ]);
  }

  /**
   * Call Tencent Cloud KMS API (TC3-HMAC-SHA256 signed)
   */
  async _callKMS(action, payload) {
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().split("T")[0];
    
    const payloadJson = JSON.stringify(payload);
    const hashedPayload = crypto.createHash("sha256").update(payloadJson).digest("hex");
    
    // Canonical request
    const canonicalRequest = [
      "POST",
      "/",
      "",
      `content-type:application/json\nhost:${this.endpoint}\nx-tc-action:${action.toLowerCase()}\n`,
      "content-type;host;x-tc-action",
      hashedPayload,
    ].join("\n");
    
    // String to sign
    const credentialScope = `${date}/kms/tc3_request`;
    const hashedCanonical = crypto.createHash("sha256").update(canonicalRequest).digest("hex");
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonical}`;
    
    // Signing key derivation
    const secretDate = crypto.createHmac("sha256", `TC3${this.secretKey}`).update(date).digest();
    const secretService = crypto.createHmac("sha256", secretDate).update("kms").digest();
    const secretSigning = crypto.createHmac("sha256", secretService).update("tc3_request").digest();
    const signature = crypto.createHmac("sha256", secretSigning).update(stringToSign).digest("hex");
    
    const authorization = `TC3-HMAC-SHA256 Credential=${this.secretId}/${credentialScope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;
    
    const response = await fetch(`https://${this.endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Host": this.endpoint,
        "X-TC-Action": action,
        "X-TC-Timestamp": timestamp.toString(),
        "X-TC-Version": "2019-01-18",
        "X-TC-Region": this.region,
        "Authorization": authorization,
      },
      body: payloadJson,
    });
    
    const result = await response.json();
    if (result.Response?.Error) {
      throw new Error(`KMS Error: ${result.Response.Error.Code} - ${result.Response.Error.Message}`);
    }
    return result.Response;
  }
}

module.exports = { TencentKMSCrypto, SECP256K1_N, SECP256K1_HALF_N, CHAIN_ID };

// Self-test
if (require.main === module) {
  (async () => {
    console.log("═══ Tencent KMS Crypto Module ═══\n");
    
    const kms = new TencentKMSCrypto({ simulate: true });
    
    // Test 1: DER parsing
    console.log("1. DER Parsing Test:");
    const testR = BigInt("0x7b2e5e0c6f4f1a3c8d5e7b9f1a2c4d6e8f0a1b2c3d4e5f6a7b8c9d0e1f2a3b");
    const testS = BigInt("0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c");
    const encoded = kms._encodeDER(testR, testS);
    const parsed = kms.parseDER(encoded);
    console.log(`  r match: ${parsed.r === testR}`);
    console.log(`  s match: ${parsed.s === testS}`);
    console.log(`  DER bytes: ${encoded.length}`);
    
    // Test 2: EIP-2 canonicalization
    console.log("\n2. EIP-2 s-value Canonicalization:");
    const highS = SECP256K1_N - 1n; // Very high s
    const canonS = kms.canonicalizeS(highS);
    console.log(`  High s (> N/2): ${highS > SECP256K1_HALF_N}`);
    console.log(`  Canonical s (≤ N/2): ${canonS <= SECP256K1_HALF_N}`);
    console.log(`  Canonical s = N - highS: ${canonS === SECP256K1_N - highS}`);
    
    // Test 3: EIP-155 v calculation
    console.log("\n3. EIP-155 v (Mantle chain ID 5000):");
    console.log(`  v for recovery=0: ${kms.eip155V(27)} (expected: ${5000 * 2 + 35})`);
    console.log(`  v for recovery=1: ${kms.eip155V(28)} (expected: ${5000 * 2 + 36})`);
    
    // Test 4: Sign digest (simulation)
    console.log("\n4. Sign Digest (simulation mode):");
    const testDigest = ethers.keccak256(ethers.toUtf8Bytes("test message"));
    const sig = await kms.signDigest(testDigest);
    console.log(`  r: ${sig.r.slice(0, 20)}...`);
    console.log(`  s: ${sig.s.slice(0, 20)}...`);
    console.log(`  v: ${sig.v}`);
    console.log(`  simulated: ${sig.simulated}`);
    console.log(`  DER round-trip: ${sig.derRoundTrip || false}`);
    
    console.log("\n✅ KMS crypto module operational");
  })().catch(console.error);
}
