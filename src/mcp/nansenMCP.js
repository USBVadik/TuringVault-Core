/**
 * TuringVault — Nansen MCP Client
 * 
 * Connects to Nansen's Model Context Protocol server for institutional-grade
 * blockchain intelligence. Provides Smart Money tracking, token analysis,
 * and wallet profiling via JSON-RPC 2.0 over Streamable HTTP (SSE).
 * 
 * Protocol: JSON-RPC 2.0 over Server-Sent Events
 * Endpoint: https://mcp.nansen.ai/ra/mcp
 * Auth: NANSEN-API-KEY header
 * Credits: 5 per MCP tool call (vs 10 per REST API call on free plan)
 */

const NANSEN_MCP_ENDPOINT = "https://mcp.nansen.ai/ra/mcp";

class NansenMCPClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = NANSEN_MCP_ENDPOINT;
    this.requestId = 0;
    this.cache = new Map();
    this.cacheTTL = 15 * 60 * 1000; // 15 min cache
  }

  /**
   * Call a Nansen MCP tool via JSON-RPC 2.0
   * @param {string} tool — tool name (e.g., "smart_traders_and_funds_token_balances")
   * @param {Object} params — tool parameters
   * @returns {Object} tool result
   */
  async callTool(tool, params = {}) {
    const cacheKey = `${tool}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.cacheTTL) {
      return cached.data;
    }

    const body = {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: "tools/call",
      params: {
        name: tool,
        arguments: params
      }
    };

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "NANSEN-API-KEY": this.apiKey
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Nansen MCP HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      // Handle SSE or direct JSON response
      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("text/event-stream")) {
        return await this._parseSSE(response, cacheKey);
      } else {
        const json = await response.json();
        if (json.error) throw new Error(`MCP error: ${json.error.message}`);
        const result = json.result?.content?.[0]?.text 
          ? JSON.parse(json.result.content[0].text) 
          : json.result;
        this.cache.set(cacheKey, { data: result, ts: Date.now() });
        return result;
      }
    } catch (err) {
      console.warn(`[Nansen MCP] ${tool} failed: ${err.message}`);
      return null;
    }
  }

  async _parseSSE(response, cacheKey) {
    const text = await response.text();
    const lines = text.split("\n");
    let lastData = null;
    
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          lastData = JSON.parse(line.slice(6));
        } catch {}
      }
    }

    if (lastData?.result?.content?.[0]?.text) {
      try {
        const parsed = JSON.parse(lastData.result.content[0].text);
        this.cache.set(cacheKey, { data: parsed, ts: Date.now() });
        return parsed;
      } catch {}
    }

    this.cache.set(cacheKey, { data: lastData?.result || lastData, ts: Date.now() });
    return lastData?.result || lastData;
  }

  // ─── High-Level Methods (Agent-Friendly) ──────────────────────

  /**
   * Get Smart Money holdings & 24h changes
   * Credits: 5 per call
   */
  async getSmartMoneyBalances(params = {}) {
    return this.callTool("smart_traders_and_funds_token_balances", {
      chain: "ethereum",
      ...params
    });
  }

  /**
   * Smart Money perpetual trades (Hyperliquid)
   * Credits: 5 per call
   */
  async getSmartMoneyPerpTrades(params = {}) {
    return this.callTool("smart_traders_and_funds_perp_trades", params);
  }

  /**
   * Top token holders with Nansen labels
   * Credits: 5 per call
   */
  async getTokenTopHolders(tokenAddress, chain = "ethereum") {
    return this.callTool("token_current_top_holders", {
      token_address: tokenAddress,
      chain
    });
  }

  /**
   * DEX trading activity for a token
   * Credits: 5 per call  
   */
  async getTokenDexTrades(tokenAddress, chain = "ethereum") {
    return this.callTool("token_dex_trades", {
      token_address: tokenAddress,
      chain
    });
  }

  /**
   * General search — entities, smart money, tokens
   * Credits: 5 per call
   */
  async search(query) {
    return this.callTool("general_search", { query });
  }

  /**
   * Wallet PnL summary
   * Credits: 5 per call
   */
  async getWalletPnL(address, chain = "ethereum") {
    return this.callTool("wallet_pnl_summary", {
      address,
      chain
    });
  }

  /**
   * Address portfolio — full DeFi positions
   * Credits: 5 per call
   */
  async getAddressPortfolio(address, chain = "ethereum") {
    return this.callTool("address_portfolio", {
      address,
      chain
    });
  }

  /**
   * Token God Mode — comprehensive token analysis
   * Credits: 5 per call
   */
  async getTokenAnalysis(tokenAddress, chain = "ethereum") {
    return this.callTool("token_god_mode", {
      token_address: tokenAddress,
      chain
    });
  }

  /**
   * Get chain growth rankings
   * Credits: 5 per call
   */
  async getChainGrowthRank() {
    return this.callTool("growth_chain_rank", {});
  }

  /**
   * Aggregate Smart Money intelligence for agent prompt context
   * Uses 2-3 calls (10-15 credits) — call sparingly
   * Returns formatted string for LLM prompt injection
   */
  async getSmartMoneyContext() {
    const [balances, perpTrades] = await Promise.all([
      this.getSmartMoneyBalances(),
      this.getSmartMoneyPerpTrades()
    ]);

    let context = "=== NANSEN SMART MONEY INTELLIGENCE ===\n";
    
    if (balances) {
      context += "\n[Smart Money Token Holdings - 24h Changes]\n";
      context += typeof balances === "string" ? balances : JSON.stringify(balances, null, 2).slice(0, 2000);
    }
    
    if (perpTrades) {
      context += "\n\n[Smart Money Perpetual Positions (Hyperliquid)]\n";
      context += typeof perpTrades === "string" ? perpTrades : JSON.stringify(perpTrades, null, 2).slice(0, 2000);
    }
    
    context += "\n=== END NANSEN DATA ===";
    return context;
  }

  /**
   * List available MCP tools (for discovery/debugging)
   */
  async listTools() {
    const body = {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: "tools/list",
      params: {}
    };

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "NANSEN-API-KEY": this.apiKey
      },
      body: JSON.stringify(body)
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const text = await response.text();
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try { return JSON.parse(line.slice(6)); } catch {}
        }
      }
    }
    return await response.json();
  }
}

module.exports = { NansenMCPClient };
