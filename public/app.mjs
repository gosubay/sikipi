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
  $("reveal").hidden = true;
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
  $("play-weak").parentElement.querySelectorAll("button")[slot]?.focus({preventScroll:true});
  if (slot >= 2) $("play-strong").children[slot-2].focus({preventScroll:true});
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
  $("reveal").innerHTML = `<div class="notice">
    <h3 class="result-title">${labels[pay]} · ${signed(pay,0)} pts</h3>
    <p>Banker: ${splitText(banker)}</p>
    <p>Your split: <strong>${signed(pick.ev)} EV</strong>${best.net===pick.net ? " · Best split" : ` · ${signed(best.ev-pick.ev)} EV left on the table`}</p>
    ${best.net===pick.net ? "" : `<p>Best: ${splitText(best)} · ${signed(best.ev)} EV</p>`}
    <details><summary>Show your pre-reveal odds</summary><p>${odds(pick)}</p><p class="meta">${styleNames[style]}</p></details>
    </div>`;
  $("reveal").hidden = false;
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
  $("calculation").innerHTML = `<p class="meta">${styleNames[style]} · Exact odds across 194,580 possible banker hands</p>` +
    rows.map(row => {
      const best = row.net===rows[0].net;
      return `<article class="arrangement ${best?"best":""}"><strong>${splitText(row)}</strong>${best?`<span class="best-label">Best EV</span>`:""}<p>${odds(row)}</p></article>`;
    }).join("");
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
    const example = baseline.example.map(option => `${option.bottom.join("–")} / ${option.top.join("–")} (${signed(option.ev)} EV)`).join(" versus ");
    $("research").innerHTML = `
      <section class="research-block"><h3>How to set your hand</h3>
      <p class="meta">Gong on, banker takes ties, even-money scoring</p>
      <ol>
      <li>Keep two pairs together.</li>
      <li>With no pair available, make Gong. It was best in ${percent(weakGong[1]/weakGong[0])} and ${percent(strongGong[1]/strongGong[0])} of these hands against the two pure banker styles.</li>
      <li>Usually keep a single pair. Check alternatives that substantially improve the weak side. With A–2–8–8 against the weak-hand banker, the splits are ${example}.</li>
      <li>With ordinary point hands, maximize your strong side against a weak-hand banker (${percent(weakPoints[1]/weakPoints[0])} exact-best) and your weak side against a strong-hand banker (${percent(strongPoints[1]/strongPoints[0])} exact-best).</li>
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

