const {
  queryRecentEventsInChunks,
} = require("../../frontend/app/api/decisions/recentEvents.js");

describe("decision event window helper", () => {
  test("queries recent logs in bounded backward chunks", async () => {
    const calls = [];
    const contract = {
      queryFilter: jest.fn(async (eventName, fromBlock, toBlock) => {
        calls.push({ eventName, fromBlock, toBlock });
        if (fromBlock === 90501 && toBlock === 100000) {
          return [{ id: "late-1" }, { id: "late-2" }];
        }
        if (fromBlock === 81001 && toBlock === 90500) {
          return [{ id: "old-1" }, { id: "old-2" }, { id: "old-3" }];
        }
        return [];
      }),
    };

    const events = await queryRecentEventsInChunks({
      contract,
      eventName: "DecisionLogged",
      currentBlock: 100000,
      fromBlock: 60000,
      limit: 4,
      blockRangeLimit: 9500,
    });

    expect(events.map((event) => event.id)).toEqual([
      "old-2",
      "old-3",
      "late-1",
      "late-2",
    ]);
    expect(calls).toEqual([
      { eventName: "DecisionLogged", fromBlock: 90501, toBlock: 100000 },
      { eventName: "DecisionLogged", fromBlock: 81001, toBlock: 90500 },
    ]);
    for (const call of calls) {
      expect(call.toBlock - call.fromBlock + 1).toBeLessThanOrEqual(9500);
    }
  });

  test("stops at the configured oldest block when sparse", async () => {
    const calls = [];
    const contract = {
      queryFilter: jest.fn(async (eventName, fromBlock, toBlock) => {
        calls.push({ eventName, fromBlock, toBlock });
        return [];
      }),
    };

    const events = await queryRecentEventsInChunks({
      contract,
      eventName: "DecisionLogged",
      currentBlock: 25000,
      fromBlock: 10000,
      limit: 20,
      blockRangeLimit: 9500,
    });

    expect(events).toEqual([]);
    expect(calls).toEqual([
      { eventName: "DecisionLogged", fromBlock: 15501, toBlock: 25000 },
      { eventName: "DecisionLogged", fromBlock: 10000, toBlock: 15500 },
    ]);
  });
});
