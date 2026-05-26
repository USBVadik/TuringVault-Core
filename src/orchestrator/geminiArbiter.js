/**
 * Gemini 3.5 Flash Arbiter — via Vertex AI (global endpoint)
 * 
 * Uses service account from /root/delusion_key.json (project: lina-494709)
 * Endpoint: aiplatform.googleapis.com/v1/projects/lina-494709/locations/global/publishers/google/models/gemini-3.5-flash
 */
const crypto = require("crypto");
const fs = require("fs");

// Path resolution order:
//   1. GOOGLE_APPLICATION_CREDENTIALS env var (standard for Vertex AI)
//   2. ./gemini-service-account.json in repo root
//   3. /root/delusion_key.json (legacy VM path)
// If none exist, callGeminiArbiter throws and the orchestrator
// catches it (defaulting to conservative=block).
const KEY_PATH = (() => {
  const path = require('path');
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(__dirname, '../../gemini-service-account.json'),
    '/root/delusion_key.json',
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return candidates[candidates.length - 1]; // last fallback path; will ENOENT if missing
})();
const PROJECT_ID = process.env.GEMINI_PROJECT_ID || "lina-494709";
const MODEL = "gemini-3.5-flash";
const ENDPOINT = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/${MODEL}:generateContent`;

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
  
  const key = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })).toString("base64url");
  
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(header + "." + payload);
  const signature = sign.sign(key.private_key, "base64url");
  const jwt = header + "." + payload + "." + signature;
  
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt
  });
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 3500000; // ~58 min
  return cachedToken;
}

/**
 * Call Gemini 3.5 Flash with a prompt
 * @param {string} systemPrompt - system instruction
 * @param {string} userMessage - user message
 * @returns {object} parsed JSON response
 */
async function callGeminiArbiter(systemPrompt, userMessage) {
  const token = await getAccessToken();
  
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { 
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 1024 }
      }
    })
  });
  
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${errText.substring(0, 200)}`);
  }
  
  const data = await resp.json();
  
  // Gemini 3.5 Flash is a thinking model — text may be in any part
  let text = "";
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (p.text) text += p.text;
  }
  
  if (!text) {
    // Fallback: check if response was cut short
    const finishReason = data.candidates?.[0]?.finishReason;
    throw new Error(`No text in Gemini response (finishReason: ${finishReason})`);
  }
  
  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Gemini response: " + text.substring(0, 200));
  
  return JSON.parse(jsonMatch[0]);
}

module.exports = { callGeminiArbiter, getAccessToken };
