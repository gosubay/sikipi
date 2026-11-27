export const ranks = "A 2 3 4 5 6 7 8 9 10 J Q K".split(" ");
const pairings = [[0,1,2,3], [0,2,1,3], [0,3,1,2]];
const choose = [[1,0,0,0,0], [1,1,0,0,0], [1,2,1,0,0], [1,3,3,1,0], [1,4,6,4,1]];
const styles = ["weak", "strong"];
export const bankerHands = 194580;

export function score(a, b, gong) {
  if (a === b) return a === 0 ? 23 : 10 + a;
  if (gong && Math.min(a,b) === 1 && Math.max(a,b) === 7) return 10;
  return ((a < 9 ? a + 1 : 0) + (b < 9 ? b + 1 : 0)) % 10;
}

export function arrange(a, b, gong) {
  const first = score(...a, gong);
  const second = score(...b, gong);
  return first >= second
    ? { high: first, low: second, top: b, bottom: a }
    : { high: second, low: first, top: a, bottom: b };
}

export const key = hand => [...hand].sort((a,b) => a-b).join(",");
export const setKey = split => split.high * 24 + split.low;

export function splits(hand, gong) {
  const seen = new Set();
  return pairings.map(([a,b,c,d]) => arrange([hand[a],hand[b]], [hand[c],hand[d]], gong))
    .filter(split => {
      const id = [key(split.top), key(split.bottom)].sort().join("/");
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export function bankerSplit(options, style) {
  const priority = style === "weak"
    ? split => split.low * 24 + split.high
    : setKey;
  return options.reduce((best, split) => priority(split) > priority(best) ? split : best);
}

export function result(high, low, bankHigh, bankLow, ties) {
  if (ties === "push" && (high === bankHigh || low === bankLow)) return 0;
  return Number(high > bankHigh) + Number(low > bankLow) - 1;
}

export const patterns = [];
for (let a=0;a<13;a++) for (let b=a;b<13;b++) for (let c=b;c<13;c++) for (let d=c;d<13;d++) {
  const hand = [a,b,c,d];
  const weights = [];
  for (const rank of hand) {
    if (weights.at(-1)?.[0] === rank) weights.at(-1)[1]++;
    else weights.push([rank,1]);
  }
  patterns.push({hand, weights, multiplicity: weights.reduce((n,[rank,count]) => n * choose[4][count],1)});
}

const tableCache = new Map();

function bankerTable(gong) {
  if (!tableCache.has(gong)) {
    tableCache.set(gong, patterns.map(({hand, weights}) => {
      const options = splits(hand,gong);
      return { weights, scores: styles.map(style => setKey(bankerSplit(options,style))) };
    }));
  }
  return tableCache.get(gong);
}

export function exact(hand, gong, ties, banker) {
  return exactForStyles(hand, gong, ties)[banker];
}

export function exactForStyles(hand, gong, ties) {
  const available = Array(13).fill(4);
  for (const rank of hand) available[rank]--;
  const distributions = styles.map(() => new Uint32Array(576));
  for (const { weights, scores } of bankerTable(gong)) {
    let weight = 1;
    for (const [rank,count] of weights) weight *= choose[available[rank]][count];
    if (weight) {
      distributions[0][scores[0]] += weight;
      distributions[1][scores[1]] += weight;
    }
  }
  const options = splits(hand,gong);
  const rows = distributions.map(dist => options.map(split => {
    const counts = [0,0,0];
    for (let id=0;id<dist.length;id++) {
      if (dist[id]) counts[1 + result(split.high,split.low,Math.floor(id/24),id%24,ties)] += dist[id];
    }
    return counts;
  }));
  const summarize = (counts, divisor) => options.map((split,i) => {
    const [loss,push,win] = counts[i].map(n => n/divisor);
    return {...split, win, push, loss, ev: win-loss, net: counts[i][2]-counts[i][0]};
  }).sort((a,b) => b.net-a.net);
  return {
    weak: summarize(rows[0],bankerHands),
    strong: summarize(rows[1],bankerHands),
    mixed: summarize(rows[0].map((counts,i) => counts.map((n,j) => n+rows[1][i][j])),2*bankerHands),
  };
}

export function deal(random = Math.random) {
  const deck = Array.from({length:52}, (_,i) => i);
  for (let i=0;i<8;i++) {
    const j = i + Math.floor(random() * (52-i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0,8).map(card => Math.floor(card/4));
}

export function rating(value) {
  if (value === 10) return "Gong";
  if (value > 10) return "Pair of " + ranks[value === 23 ? 0 : value-10];
  return value + (value === 1 ? " point" : " points");
}

