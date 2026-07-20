const parse = require('metar-parser');

console.log("=== CAVOK Test ===");
const raw = "LTFM 181250Z 04015KT CAVOK 15/09 Q1013 NOSIG";
const m = parse(raw);

console.log("CAVOK raw parse:", JSON.stringify({
  visibility: m.visibility,
  cavok: m.cavok
}, null, 2));

// This simulates the logic in route.js
const routeLogic = {
  visibility: m.visibility?.meters || null,
  cavok: m.cavok
};

console.log("\nroute.js parsing logic output:", JSON.stringify(routeLogic, null, 2));
