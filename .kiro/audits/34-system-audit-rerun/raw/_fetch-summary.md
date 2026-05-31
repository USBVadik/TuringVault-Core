# Audit 34 frontend/API fetch summary

started: 2026-05-31T20:55:52.065Z
ended: 2026-05-31T20:56:08.043Z

| Kind | Surface | HTTP | Bytes | ms | cache | age | Flags | Notable fields |
| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| ui | `/` | 200 | 63041 | 310 | HIT | 2839 |  |  |
| ui | `/backtest` | 200 | 28254 | 408 | PRERENDER | 0 |  |  |
| ui | `/challenge` | 200 | 32356 | 317 | PRERENDER | 0 |  |  |
| ui | `/discipline` | 200 | 28481 | 357 | PRERENDER | 0 |  |  |
| ui | `/proof-explorer` | 200 | 122019 | 59 | HIT | 2261 | old-proof-copy |  |
| ui | `/social` | 200 | 32238 | 397 | PRERENDER | 0 |  |  |
| ui | `/replay` | 200 | 69757 | 167 | STALE | 1936 |  |  |
| api | `/api/health` | 200 | 1670 | 49 | HIT | 15 |  | lastCycleAge=4317; succeeded24h=21; failed24h=0; tier= |
| api | `/api/decisions` | 200 | 15456 | 51 | HIT | 44 |  | total=203; approved=133; rejected=70; latest=BLOCKED_BY_PORTFOLIO |
| api | `/api/strategy` | 200 | 495 | 2087 | MISS | 0 |  | regime,position,channel,currentPrice,tp,sl,riskReward,varGate |
| api | `/api/discipline` | 200 | 14911 | 191 | MISS | 0 |  | latest,latestEntry,history,summary,gatesKnown,dataScope |
| api | `/api/elfa-snapshot` | 200 | 323 | 666 | MISS | 0 |  | available,symbol,timeWindow,fetchedAt,signal,strength,sentiment,mentionCount |
| api | `/api/backtest` | 200 | 7138 | 339 | MISS | 0 |  | summary,equityCurve,trades |
| api | `/api/agent-card` | 200 | 2538 | 4333 | MISS | 0 |  | source=on-chain-tokenURI; cardTotal=203; blockRate=34.5% |
| api | `/api/market` | 200 | 284 | 59 | HIT | 54 |  | ethPrice,ethChange24h,mantlePrice,mETHYield,mETHPool,sentiment,fearGreedValue,smartMoneyFlow |
| api | `/api/performance` | 200 | 781 | 608 | MISS | 0 |  | nav=135.38; pnlBps=1757; settled=67; winRate=46.3 |
| api | `/api/proof-explorer` | 200 | 17651 | 1211 | MISS | 0 |  | totalDecisions=202; latest= |
| api | `/api/reasoning` | 200 | 485 | 429 | MISS | 0 |  | timestamp,latestCycle,evolution,progress,intentQueue |
| api | `/api/reputation` | 200 | 237 | 549 | MISS | 0 |  | cumulativeScore,totalFeedback,positiveCount,negativeCount,winRate,normalizedScore,source,winRateDenominator |
| api | `/api/evolution` | 200 | 1266 | 1319 | MISS | 0 |  | currentVersion,totalEvolutions,tokenURI,evolutions |
| api | `/api/challenge` | 200 | 1209 | 1587 | MISS | 0 |  | mode,challenge,result,verification,note |
| api | `/api/yield-meth` | 200 | 479 | 161 | PRERENDER | 0 |  | source=cached:defillama+l1-rpc; degraded=true; apy=2.12371; assetHealth=ok |
| api | `/api/cron/trigger-cycle` | 500 | 56 | 296 | MISS | 0 | cron-secret-missing | {"error":"CRON_SECRET not configured","triggered":false} |
