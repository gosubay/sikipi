import { writeFileSync } from "node:fs";
import { bankerSplit, deal, exactForStyles, key, patterns, ranks, result, splits } from "./docs/solver.mjs";

const scenarios = [];
for (const gong of [true,false]) for (const ties of ["banker","push"]) {
  const study = Object.fromEntries(["weak","strong","mixed"].map(style => [style, {
    optimal:0, weak:0, strong:0, pair:0, close:0,
  }]));
  const hands = new Map();
  let shared = 0;
  const compareTieRules = gong && ties === "banker";
  let tieRulesChangeBest = 0;
  const breakdown = Object.fromEntries(["weak","strong"].map(style => [style,{pair:[0,0],gong:[0,0],points:[0,0]}]));
  for (const {hand,multiplicity} of patterns) {
    const solutions = exactForStyles(hand,gong,ties);
    const rules = splits(hand,gong);
    const weak = bankerSplit(rules,"weak");
    const strong = bankerSplit(rules,"strong");
    const pairOptions = rules.filter(option => option.high > 10);
    const pair = pairOptions.length ? bankerSplit(pairOptions,"weak") : weak;
    const category = pairOptions.length ? "pair" : strong.high === 10 ? "gong" : "points";
    const common = solutions.weak.some(option => option.net === solutions.weak[0].net &&
      solutions.strong.some(other => other.net === solutions.strong[0].net && other.high === option.high && other.low === option.low));
    if (common) shared += multiplicity;
    if (compareTieRules) {
      const bankerRows = solutions.mixed;
      const pushRows = exactForStyles(hand,gong,"push").mixed;
      const sameBest = bankerRows.some(option => option.net === bankerRows[0].net &&
        pushRows.some(other => other.net === pushRows[0].net && other.high === option.high && other.low === option.low));
      if (!sameBest) tieRulesChangeBest += multiplicity;
    }
    for (const [style,rows] of Object.entries(solutions)) {
      const ev = ({high,low}) => rows.find(row => row.high === high && row.low === low).ev;
      const row = study[style];
      row.optimal += multiplicity * rows[0].ev;
      row.weak += multiplicity * ev(weak);
      row.strong += multiplicity * ev(strong);
      row.pair += multiplicity * ev(pair);
      row.close += multiplicity * ev(solutions.mixed[0]);
      if (style !== "mixed") {
        const pick = category === "points" && style === "strong" ? weak : strong;
        breakdown[style][category][0] += multiplicity;
        if (Math.abs(ev(pick)-rows[0].ev) < 1e-12) breakdown[style][category][1] += multiplicity;
      }
    }
    hands.set(key(hand), { weak, strong, optimal: solutions.weak[0] });
  }
  for (const row of Object.values(study)) {
    for (const stat of Object.keys(row)) row[stat] /= 270725;
  }
  const scenario = {gong,ties, study, shared:shared/270725, breakdown};
  if (compareTieRules) {
    scenario.tieRulesChangeBest = tieRulesChangeBest/270725;
    let seed = 20261127;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2**32;
    };
    const sessions = 20000;
    const outcomes = {20:[0,0,0],50:[0,0,0]};
    for (let session=0; session<sessions; session++) {
      let difference = 0;
      for (let round=1;round<=50;round++) {
        const cards = deal(random);
        const player = hands.get(key(cards.slice(0,4)));
        const banker = hands.get(key(cards.slice(4))).weak;
        const pay = ({high,low}) => result(high,low,banker.high,banker.low,ties);
        difference += pay(player.optimal) - pay(player.weak);
        if (round === 20 || round === 50) outcomes[round][1 + Math.sign(difference)]++;
      }
    }
    const example = [0,1,7,7];
    scenario.session = {sessions, outcomes};
    scenario.example = exactForStyles(example,gong,ties).weak.map(row => ({
      top: row.top.map(rank => ranks[rank]), bottom: row.bottom.map(rank => ranks[rank]), ev:row.ev
    }));
  }
  console.log("Completed", gong ? "Gong on" : "Gong off", ties);
  scenarios.push(scenario);
}
writeFileSync(new URL("./docs/findings.json",import.meta.url),JSON.stringify(scenarios,null,2)+"\n");

