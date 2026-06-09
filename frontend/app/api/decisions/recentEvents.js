const DEFAULT_BLOCK_RANGE_LIMIT = 9500;

async function queryRecentEventsInChunks({
  contract,
  eventName,
  currentBlock,
  fromBlock,
  limit,
  blockRangeLimit = DEFAULT_BLOCK_RANGE_LIMIT,
}) {
  const boundedLimit = Math.max(1, Number(limit) || 1);
  const safeRange = Math.max(1, Number(blockRangeLimit) || DEFAULT_BLOCK_RANGE_LIMIT);
  const oldestBlock = Math.max(0, Number(fromBlock) || 0);
  let toBlock = Math.max(oldestBlock, Number(currentBlock) || 0);
  let events = [];

  while (toBlock >= oldestBlock && events.length < boundedLimit) {
    const chunkFrom = Math.max(oldestBlock, toBlock - safeRange + 1);
    const chunkEvents = await contract.queryFilter(eventName, chunkFrom, toBlock);
    if (Array.isArray(chunkEvents) && chunkEvents.length > 0) {
      events = [...chunkEvents, ...events];
    }
    toBlock = chunkFrom - 1;
  }

  return events.slice(-boundedLimit);
}

module.exports = {
  DEFAULT_BLOCK_RANGE_LIMIT,
  queryRecentEventsInChunks,
};
