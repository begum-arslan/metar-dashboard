const parse = require('metar-parser');
const raw = "LTFM 181250Z 04015G25KT 9999 -TSRA +SN VCFG FEW030 15/09 Q1013 NOSIG";
const m = parse(raw);
console.log(JSON.stringify(m.weather, null, 2));
