import { arrange, bankerSplit, deal, exact, ranks, rating, result, score, setKey, splits } from "./solver.mjs";

const $ = id => document.getElementById(id);
const inputs = [...$("inputs").querySelectorAll("input")];
const readSettings = () => ({gong:$("gong").checked, ties:$("ties").value, style:$("banker").value});
const styleNames = {weak:"Banker maximizes weak", strong:"Banker maximizes strong", mixed:"Banker uses a 50/50 mix"};
const signed = (value, digits=3) => (value>0 ? "+" : "") + value.toFixed(digits);
const percent = value => (value*100).toFixed(1) + "%";
const cardsText = cards => cards.map(rank => ranks[rank]).join(" · ");
const splitText = split => `Weak ${cardsText(split.top)} (${rating(split.low)}) · Strong ${cardsText(split.bottom)} (${rating(split.high)})`;
const labels = {"-1":"Loss", 0:"Push", 1:"Win"};
let activeTab = "play";
let round;
let tally = newScore();
let selectedInput = 0;
let findings;

function newScore() {
  return {points:0, wins:0, pushes:0, losses:0};
}

function nextRound() {
  const cards = deal();
  round = {
    hand:cards.slice(0,4), banker:cards.slice(4), mixedStyle:Math.random()<.5?"weak":"strong",
    slots:Array(4).fill(null), selected:null, locked:false,
  };
  $("reveal").replaceChildren();
  renderMatchup();
  $("lock").hidden = false;
  $("next").hidden = true;
  $("play-message").textContent = "";
  renderPlay();
}

function renderScore() {
  $("tally").innerHTML = `<strong>${signed(tally.points,0)} pts</strong><span>${tally.wins} wins · ${tally.pushes} pushes · ${tally.losses} losses</span>`;
}

function place(slot, card) {
  if (round.locked || !Number.isInteger(card) || card < 0 || card >= 4) return;
  const oldSlot = round.slots.indexOf(card);
  if (oldSlot >= 0) round.slots[oldSlot] = round.slots[slot];
  round.slots[slot] = card;
  round.selected = null;
  renderPlay();
  $(slot < 2 ? "play-weak" : "play-strong").children[slot % 2].focus({preventScroll:true});
}

function onDrop(element, type, handler) {
  element.addEventListener("dragover", event => {
    if ([...event.dataTransfer.types].includes(type)) event.preventDefault();
  });
  element.addEventListener("drop", event => {
    if (![...event.dataTransfer.types].includes(type)) return;
    event.preventDefault();
    handler(Number(event.dataTransfer.getData(type)));
  });
}

function draggable(button, type, id) {
  button.draggable = true;
  button.addEventListener("dragstart", event => event.dataTransfer.setData(type,String(id)));
}

function renderPlay() {
  const {gong} = readSettings();
  $("tray").replaceChildren();
  $("play-weak").replaceChildren();
  $("play-strong").replaceChildren();
  for (let id=0;id<4;id++) {
    const card = document.createElement("button");
    card.className = "card";
    card.textContent = ranks[round.hand[id]];
    card.setAttribute("aria-label", `Select ${ranks[round.hand[id]]}, dealt card ${id+1}`);
    card.setAttribute("aria-pressed",round.selected===id);
    card.disabled = round.locked;
    if (round.slots.includes(id)) card.style.visibility = "hidden";
    card.onclick = () => {
      round.selected = round.selected === id ? null : id;
      renderPlay();
      $("tray").children[id].focus();
    };
    if (!round.locked) draggable(card,"application/x-sikipi-play",id);
    $("tray").append(card);
  }
  for (let slot=0;slot<4;slot++) {
    const id = round.slots[slot];
    const button = document.createElement("button");
    button.className = id === null ? "slot" : "card";
    button.textContent = id === null ? "＋" : ranks[round.hand[id]];
    button.setAttribute("aria-label", `${slot<2?"Weak":"Strong"} slot ${slot%2+1}${id===null?", empty":", "+ranks[round.hand[id]]}`);
    button.disabled = round.locked;
    button.onclick = () => {
      if (round.selected !== null) place(slot,round.selected);
      else if (id !== null) {
        round.slots[slot] = null;
        round.selected = id;
        renderPlay();
        $("tray").children[id].focus();
      }
    };
    if (!round.locked) {
      if (id !== null) draggable(button,"application/x-sikipi-play",id);
      onDrop(button,"application/x-sikipi-play",card => place(slot,card));
    }
    $(slot<2?"play-weak":"play-strong").append(button);
  }
  const needsCards = round.slots.includes(null);
  const cards = round.slots.map(id => round.hand[id]);
  const invalid = !needsCards && score(cards[0],cards[1],gong) > score(cards[2],cards[3],gong);
  $("lock").disabled = round.locked || needsCards || invalid;
  if (!round.locked) $("play-message").textContent = invalid ? "The weak row must rank at or below the strong row." : "";
}

function renderMatchup(player = null, banker = null) {
  const bankerHand = $("banker-hand");
  bankerHand.classList.toggle("is-revealed", Boolean(banker));
  bankerHand.setAttribute("aria-label", banker ? "Computer’s revealed hand" : "Computer’s face-down cards");
  const backs = '<span class="card banker-card banker-back" aria-hidden="true">♠</span>'.repeat(2);
  $("banker-weak").innerHTML = banker ? cardFaces(banker.top, "banker-card") : backs;
  $("banker-strong").innerHTML = banker ? cardFaces(banker.bottom, "banker-card") : backs;
  $("banker-low").textContent = banker ? rating(banker.low) : "";
  $("banker-high").textContent = banker ? rating(banker.high) : "";
  $("player-low").textContent = player ? rating(player.low) : "";
  $("player-high").textContent = player ? rating(player.high) : "";
}

function odds(row) {
  return `Win ${percent(row.win)} · Push ${percent(row.push)} · Loss ${percent(row.loss)} · EV ${signed(row.ev)} pts/deal`;
}

$("lock").onclick = () => {
  if ($("lock").disabled || round.locked) return;
  const {gong,ties,style} = readSettings();
  const cards = round.slots.map(id => round.hand[id]);
  const player = arrange(cards.slice(2),cards.slice(0,2),gong);
  const usedStyle = style==="mixed"?round.mixedStyle:style;
  const banker = bankerSplit(splits(round.banker,gong),usedStyle);
  const rows = exact(round.hand,gong,ties,style);
  const pick = rows.find(row => setKey(row) === setKey(player));
  const best = rows[0];
  const pay = result(player.high,player.low,banker.high,banker.low,ties);
  tally.points += pay;
  tally[pay===1?"wins":pay===0?"pushes":"losses"]++;
  round.locked = true;
  const isBest = pick.net === best.net;
  renderMatchup(player, banker);
  $("reveal").innerHTML = `<div class="notice">
    <h3 class="result-title">${labels[pay]} · ${signed(pay,0)} pts</h3>
    <p class="move-feedback${isBest ? " best-move" : ""}"><strong>${isBest ? "You picked a highest-EV move." : "You picked a lower-EV move."}</strong> Your split: ${signed(pick.ev)} pts/deal.</p>
    ${isBest ? "" : `<p>Best split: ${splitText(best)} · ${signed(best.ev)} pts/deal (${signed(best.ev-pick.ev)} higher).</p>`}
    <details><summary>Show your pre-reveal odds</summary><p>${odds(pick)}</p><p class="meta">${styleNames[style]}</p></details>
    </div>`;
  $("lock").hidden = true;
  $("next").hidden = false;
  renderPlay();
  renderScore();
  $("next").focus();
};

$("next").onclick = () => { nextRound(); $("tray").firstChild.focus(); };
$("reset").onclick = () => { tally = newScore(); renderScore(); };
onDrop($("tray"),"application/x-sikipi-play",id => {
  if (round.locked) return;
  const slot = round.slots.indexOf(id);
  if (slot >= 0) round.slots[slot] = null;
  round.selected = null;
  renderPlay();
});

function normalized(input) {
  const value = input.value.trim().toUpperCase();
  return value==="T"?"10":value;
}

function selectInput(index) {
  selectedInput = index;
  inputs.forEach((input,i) => input.classList.toggle("selected",i===index));
}

function assignRank(index, rank) {
  if (!ranks[rank]) return;
  inputs[index].value = ranks[rank];
  const nextEmpty = inputs.findIndex((input,i) => i > index && !input.value);
  const firstEmpty = inputs.findIndex(input => !input.value);
  selectInput(nextEmpty >= 0 ? nextEmpty : firstEmpty >= 0 ? firstEmpty : (index+1)%4);
  calculate();
}

inputs.forEach((input,i) => {
  input.onfocus = () => selectInput(i);
  input.oninput = calculate;
  onDrop(input,"application/x-sikipi-rank",rank => assignRank(i,rank));
});
ranks.forEach((rank,index) => {
  const button = document.createElement("button");
  button.textContent = rank;
  button.onclick = () => assignRank(selectedInput,index);
  draggable(button,"application/x-sikipi-rank",index);
  $("picker").append(button);
});
$("clear").onclick = () => {
  inputs.forEach(input => { input.value = ""; });
  inputs[0].focus();
  calculate();
};

function cardFaces(cards, className) {
  return cards.map(rank => `<span class="card ${className}">${ranks[rank]}</span>`).join("");
}

function splitRow(label, cards, value) {
  return `<div class="split-row">
    <div><strong>${label}</strong><span class="split-rating">${rating(value)}</span></div>
    <div class="split-cards">${cardFaces(cards, "split-card")}</div>
  </div>`;
}

function calculate() {
  const values = inputs.map(normalized);
  const hand = values.map(value => ranks.indexOf(value));
  if (values.some((value,i) => value && hand[i]<0)) {
    $("calculation").textContent = "Use A, 2–10, J, Q or K.";
    return;
  }
  if (hand.includes(-1)) {
    $("calculation").textContent = "Enter four ranks to compare the splits.";
    return;
  }
  const {gong,ties,style} = readSettings();
  const rows = exact(hand,gong,ties,style);
  $("calculation").innerHTML = `<p class="meta">${styleNames[style]} · Exact odds across 194,580 possible banker hands</p>
    <div class="split-options">${rows.map(row => {
      const best = row.net === rows[0].net;
      return `<article class="arrangement${best ? " best" : ""}">
        ${splitRow("Front (weak)", row.top, row.low)}
        ${splitRow("Back (strong)", row.bottom, row.high)}
        <dl class="split-stats">
          <div><dt>Win</dt><dd>${percent(row.win)}</dd></div>
          <div><dt>Push</dt><dd>${percent(row.push)}</dd></div>
          <div><dt>Loss</dt><dd>${percent(row.loss)}</dd></div>
          <div class="split-ev"><dt>EV</dt><dd>${signed(row.ev)} pts/deal${best ? '<span class="best-label">Best EV</span>' : ""}</dd></div>
        </dl>
      </article>`;
    }).join("")}</div>`;
}

function tipExample(title, top, bottom, ev) {
  const front = top.map(rank => ranks.indexOf(rank));
  const back = bottom.map(rank => ranks.indexOf(rank));
  return `<figure class="tip-example">
    <figcaption>${title}${ev === undefined ? "" : `<span>${signed(ev)} EV</span>`}</figcaption>
    ${splitRow("Front", front, score(...front, true))}
    ${splitRow("Back", back, score(...back, true))}
  </figure>`;
}

async function showFindings() {
  try {
    if (!findings) {
      const response = await fetch("./findings.json");
      if (!response.ok) throw new Error("Data unavailable");
      findings = await response.json();
    }
    const {gong,ties} = readSettings();
    const row = findings.find(row => row.gong===gong && row.ties===ties);
    const baseline = findings.find(row => row.session);
    const session = baseline.session;
    const weakPoints = baseline.breakdown.weak.points;
    const strongPoints = baseline.breakdown.strong.points;
    const weakGong = baseline.breakdown.weak.gong;
    const strongGong = baseline.breakdown.strong.gong;
    $("research").innerHTML = `
      <section class="research-block"><h3 class="tips-heading"><svg class="tips-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="8" y="4" width="11" height="15" rx="2"/><path d="M5 8v11a3 3 0 0 0 3 3h7m-3-10 1.5-2 1.5 2-1.5 2z"/></svg>How to set your hand</h3>
      <p class="meta">Gong on · Banker takes ties · Even-money scoring</p>
      <ol class="strategy-tips" role="list">
      <li><h4>Keep two pairs together</h4>
      <div class="tip-examples">${tipExample("Keep both pairs", ["3","3"], ["Q","Q"])}</div></li>
      <li><h4>Make Gong when there’s no pair</h4>
      <p>Best in ${percent(weakGong[1]/weakGong[0])} of eligible hands against the weak-hand banker and ${percent(strongGong[1]/strongGong[0])} against the strong-hand banker.</p>
      <div class="tip-examples">${tipExample("Put Gong in back", ["K","9"], ["2","8"])}</div></li>
      <li><h4>Usually keep a single pair</h4>
      <p>Sometimes breaking it improves the front enough to gain EV. Here’s A–2–8–8 against the weak-hand banker.</p>
      <div class="tip-examples">${baseline.example.map((option, i) => tipExample(i === 0 ? "Break the pair" : "Keep the pair", option.top, option.bottom, option.ev)).join("")}</div></li>
      <li><h4>Adjust ordinary point hands to the banker</h4>
      <p>Maximize your back against a weak-hand banker (${percent(weakPoints[1]/weakPoints[0])} best) and your front against a strong-hand banker (${percent(strongPoints[1]/strongPoints[0])} best).</p>
      <div class="tip-examples">${tipExample("Vs. weak-hand banker", ["A","K"], ["3","6"])}${tipExample("Vs. strong-hand banker", ["A","3"], ["6","K"])}</div></li>
      </ol></section>
      <section class="research-block"><h3>Strategy matchups</h3>
      <p>Under the selected rules, both banker styles share an optimal split on ${percent(row.shared)} of deals. EV is points per deal.</p>
      <div class="table-wrap"><table><thead><tr><th scope="col">Banker</th><th scope="col">Best response</th><th scope="col">Max strong</th><th scope="col">Max weak</th><th scope="col">Keep pair¹</th><th scope="col">50/50 response</th></tr></thead>
      <tbody>${Object.entries(row.study).map(([style,s]) => `<tr><th scope="row">${style==="mixed"?"50/50 mix":style==="weak"?"Max weak":"Max strong"}</th>${[s.optimal,s.strong,s.weak,s.pair,s.close].map(n=>`<td>${signed(n)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="meta">¹ Keep a pair if available, then maximize the weak side. The 50/50 response assumes the banker picks between styles independently each round.</p></section>
      <section class="research-block"><h3>How often does the better strategy finish ahead?</h3>
      <p>Compared the exact best response with always maximizing the weak side, on the same deals against a banker who maximizes weak. Gong on and banker takes ties.</p>
      <div class="table-wrap"><table><thead><tr><th scope="col">Rounds</th><th scope="col">Ahead</th><th scope="col">Tied</th><th scope="col">Behind</th></tr></thead><tbody>
      ${Object.entries(session.outcomes).map(([rounds,[behind,tied,ahead]])=>`<tr><th scope="row">${rounds}</th><td>${percent(ahead/session.sessions)}</td><td>${percent(tied/session.sessions)}</td><td>${percent(behind/session.sessions)}</td></tr>`).join("")}
      </tbody></table></div><p class="meta">${session.sessions.toLocaleString()} seeded sessions. The 20-round result uses the first 20 deals of each 50-round session.</p></section>
      <details class="research-block"><summary>How we calculated this</summary><p>Each of 270,725 physical starting hands is weighted equally. For each hand, we enumerate the equivalent rank patterns for all 194,580 possible banker hands from the remaining deck. We compare both pure banker rules and their 50/50 mixture. The CNY preset uses even-money points and split comparisons by rank or point total. Suit bonuses, Bobo, and Jin Gang payouts are outside this preset.</p></details>`;
  } catch {
    $("research").textContent = "Findings could not load. Open this page through a local web server or a deployed URL.";
  }
}

document.querySelectorAll("[data-tab]").forEach(button => {
  button.onclick = () => {
    activeTab = button.dataset.tab;
    for (const tab of document.querySelectorAll("[data-tab]")) {
      $(tab.dataset.tab).hidden = tab !== button;
      if (tab === button) tab.setAttribute("aria-current","page");
      else tab.removeAttribute("aria-current");
    }
    if (activeTab==="calculate") calculate();
    if (activeTab==="findings") showFindings();
  };
});
for (const id of ["gong","ties","banker"]) $(id).onchange = () => {
  if (!round.locked) renderPlay();
  if (activeTab==="calculate") calculate();
  if (activeTab==="findings") showFindings();
};
selectInput(0);
renderScore();
nextRound();

