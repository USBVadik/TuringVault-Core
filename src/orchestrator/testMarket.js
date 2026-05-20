require("dotenv").config();
const { getMarketData } = require("./marketData");

getMarketData().then(d => {
  console.log("ETH price:       $" + d.ethPrice);
  console.log("Sentiment:       " + d.sentiment);
  console.log("Fear&Greed:      " + d.fearGreedIndex + " (" + d.fearGreedClassification + ")");
  console.log("Smart Money src: " + d.smartMoneySource);
  console.log("SM 24h flow:     $" + (d.smartMoneyFlow || 0).toLocaleString());
  console.log("Nansen sentiment:" + d.nansenSentiment);
  console.log("Top buying:      " + JSON.stringify(d.nansenTopBuying));
  console.log("Top selling:     " + JSON.stringify(d.nansenTopSelling));
  console.log("mETH Yield:      " + d.mETHYield + "%");
  console.log("Mantle TVL:      $" + (d.mantleTVL || 0).toLocaleString());
  console.log("Volatility:      " + d.volatility);
}).catch(e => console.error("ERR:", e.message));
