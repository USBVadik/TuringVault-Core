/**
 * Prompt injection sanitizer for external data entering LLM prompts.
 *
 * Strips control characters, zero-width chars, and common injection patterns
 * from untrusted strings (token symbols, MCP responses, API text) before
 * they are interpolated into system/user prompts.
 */

// Characters that should never appear in prompt data
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Zero-width / invisible Unicode (often used to hide instructions)
const INVISIBLE_UNICODE_RE =
  /[\u200B\u200C\u200D\u200E\u200F\uFEFF\u2060\u2061\u2062\u2063\u2064\u2066\u2067\u2068\u2069\u206A-\u206F]/g;

// Common injection delimiters that attempt to break out of data context
const INJECTION_DELIMITERS_RE =
  /(\[SYSTEM\]|\[INST\]|<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>|```system|###\s*SYSTEM|###\s*INSTRUCTION)/gi;

/**
 * Strip control characters and invisible Unicode from a string.
 * @param {string} str - Untrusted input string
 * @returns {string} Cleaned string
 */
function stripControlChars(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(CONTROL_CHAR_RE, "")
    .replace(INVISIBLE_UNICODE_RE, "")
    .replace(INJECTION_DELIMITERS_RE, "[FILTERED]");
}

/**
 * Sanitize an object's string values recursively (shallow: 1 level for arrays/objects).
 * Useful for market data objects before prompt interpolation.
 * @param {*} data - Input data (string, array, or object)
 * @returns {*} Sanitized copy
 */
function sanitizeForPrompt(data) {
  if (typeof data === "string") return stripControlChars(data);
  if (Array.isArray(data)) return data.map(sanitizeForPrompt);
  if (data && typeof data === "object") {
    const out = {};
    for (const [key, val] of Object.entries(data)) {
      out[key] = typeof val === "string" ? stripControlChars(val) : val;
    }
    return out;
  }
  return data;
}

/**
 * Sanitize a block of text that will be inserted as a prompt context section.
 * Truncates to maxLen to limit context stuffing attacks.
 * @param {string} text - External text block (MCP response, API body)
 * @param {number} [maxLen=2000] - Maximum allowed length
 * @returns {string} Sanitized and truncated text
 */
function sanitizeExternalText(text, maxLen = 2000) {
  if (typeof text !== "string") return "";
  const cleaned = stripControlChars(text);
  return cleaned.length > maxLen
    ? cleaned.slice(0, maxLen) + "… [truncated]"
    : cleaned;
}

module.exports = { stripControlChars, sanitizeForPrompt, sanitizeExternalText };
