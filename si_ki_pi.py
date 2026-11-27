"""Si Ki Pi hand calculator and research tools. Run with --help for commands."""
import argparse
from collections import Counter
from functools import cache
from itertools import combinations_with_replacement
from math import comb
from random import Random

RANKS = "A 2 3 4 5 6 7 8 9 10 J Q K".split()
DECK = range(52)
MATCHINGS = ((0, 1, 2, 3), (0, 2, 1, 3), (0, 3, 1, 2))
BANKERS = ("weak", "strong")
POINTS = (1, 0, -1)  # indexed by win, push, loss


def pair_score(cards, gong):
    first, second = cards
    if first == second:
        return 23 if first == 0 else 10 + first
    if gong and cards == (1, 7):
        return 10
    return (sum(rank + 1 for rank in cards if rank < 9)) % 10


@cache
def arrangements(hand, gong):
    """Return distinct splits as (high score, low score, high cards, low cards)."""
    options = []
    seen = set()
    for a, b, c, d in MATCHINGS:
        pairs = (hand[a], hand[b]), (hand[c], hand[d])
        sides = sorted(((pair_score(pair, gong), pair) for pair in pairs), reverse=True)
        (high, high_cards), (low, low_cards) = sides
        if (high_cards, low_cards) not in seen:
            seen.add((high_cards, low_cards))
            options.append((high, low, high_cards, low_cards))
    return tuple(options)


def strongest_weak(option):
    return option[1], option[0]


@cache
def strategy_scores(hand, gong):
    options = arrangements(hand, gong)
    weakest_first = max(options, key=strongest_weak)
    strongest_first = max(options)
    return weakest_first[:2], strongest_first[:2]


def outcome(player, banker, ties):
    """Return 0 for win, 1 for push, or 2 for loss."""
    high, low = player
    bank_high, bank_low = banker
    if ties == "push" and (high == bank_high or low == bank_low):
        return 1
    wins = (high > bank_high) + (low > bank_low)
    return 2 - wins


def hand_weights(hand):
    return tuple(Counter(hand).items())


@cache
def ranked_hands():
    return tuple(
        (hand, hand_weights(hand))
        for hand in combinations_with_replacement(range(13), 4)
    )


@cache
def banker_table(gong):
    return tuple(
        (weights, *strategy_scores(hand, gong))
        for hand, weights in ranked_hands()
    )


def banker_distributions(hand, gong):
    # Each rank pattern stands for this many equally likely physical card hands.
    available = [4 - hand.count(rank) for rank in range(13)]
    choices = [[comb(count, copies) for copies in range(5)] for count in available]
    weak = Counter()
    strong = Counter()
    for weights, weak_score, strong_score in banker_table(gong):
        multiplicity = 1
        for rank, copies in weights:
            multiplicity *= choices[rank][copies]
        if multiplicity:
            weak[weak_score] += multiplicity
            strong[strong_score] += multiplicity
    return {"weak": weak, "strong": strong}


def exact_results(hand, gong, ties):
    splits = arrangements(hand, gong)
    results = {}
    for strategy, distribution in banker_distributions(hand, gong).items():
        rows = []
        for split in splits:
            counts = [0, 0, 0]
            for banker_score, multiplicity in distribution.items():
                counts[outcome(split[:2], banker_score, ties)] += multiplicity
            rows.append(counts)
        results[strategy] = rows
    return splits, results


def cards_text(cards):
    return " ".join(RANKS[rank] for rank in cards)


def score_text(score):
    if score > 10:
        rank = 0 if score == 23 else score - 10
        return f"pair of {RANKS[rank]}s"
    if score == 10:
        return "Gong"
    return str(score)


def split_text(split):
    high, low, high_cards, low_cards = split
    return (
        f"{cards_text(high_cards)} ({score_text(high)}) / "
        f"{cards_text(low_cards)} ({score_text(low)})"
    )


def stats(counts):
    total = sum(counts)
    win, push, loss = (count / total for count in counts)
    return f"{win:8.2%} {push:8.2%} {loss:8.2%} {win - loss:+9.5f}"


def display_hand(hand, gong, ties, banker):
    splits, results = exact_results(hand, gong, ties)
    best_indices = {}
    print(f"\nHand {cards_text(hand)} | Gong {'on' if gong else 'off'} | ties: {ties}")
    for strategy in BANKERS:
        counts = results[strategy]
        nets = [win - loss for win, _, loss in counts]
        best = max(nets)
        best_indices[strategy] = {i for i, net in enumerate(nets) if net == best}
        selected = " (selected)" if strategy == banker else ""
        print(f"\nBanker maximizes the {strategy} hand{selected}")
        print(f"{'Strong / weak':34} {'Win':>8} {'Push':>8} {'Loss':>8} {'EV':>9}")
        for index, (split, row) in enumerate(zip(splits, counts)):
            marker = "  Best" if index in best_indices[strategy] else ""
            print(f"{split_text(split):34} {stats(row)}{marker}")
    shared = best_indices["weak"] & best_indices["strong"]
    if shared:
        print("\nBest against both: " + "; ".join(split_text(splits[i]) for i in sorted(shared)))
    else:
        print("\nThe best split changes with the banker strategy.")
    print(f"Each row covers {comb(48, 4):,} possible banker hands. EV is points per deal.")


def simulate(deals, seed, banker, gong, ties):
    rng = Random(seed)
    other_tie_rule = "push" if ties == "banker" else "banker"
    configs = ((gong, ties), (not gong, ties), (gong, other_tie_rule))
    tally = {config: [[0, 0, 0] for _ in range(3)] for config in configs}
    # The cards and random-split choice are shared across all rules and strategies.
    for _ in range(deals):
        cards = rng.sample(DECK, 8)
        player = tuple(sorted(card // 4 for card in cards[:4]))
        dealer = tuple(sorted(card // 4 for card in cards[4:]))
        random_matching = rng.randrange(3)
        for (has_gong, tie_rule), rows in tally.items():
            weak, strong = strategy_scores(player, has_gong)
            bank_weak, bank_strong = strategy_scores(dealer, has_gong)
            bank = bank_weak if banker == "weak" else bank_strong
            # Randomize over physical pairings, even when some have equal ranks.
            random_split = physical_split(player, has_gong, random_matching)
            for row, score in zip(rows, (random_split, weak, strong)):
                row[outcome(score, bank, tie_rule)] += 1
    print(f"{deals:,} shared deals | seed {seed} | banker maximizes {banker}")
    for (has_gong, tie_rule), rows in tally.items():
        print(f"\nGong {'on' if has_gong else 'off'} | ties: {tie_rule}")
        print(f"{'Strategy':20} {'Win':>8} {'Push':>8} {'Loss':>8} {'EV':>9}")
        for name, row in zip(("Random", "Maximize weak", "Maximize strong"), rows):
            print(f"{name:20} {stats(row)}")


@cache
def physical_split(hand, gong, matching):
    a, b, c, d = MATCHINGS[matching]
    first = pair_score((hand[a], hand[b]), gong)
    second = pair_score((hand[c], hand[d]), gong)
    return max(first, second), min(first, second)


def study(gong, ties):
    """Score simple rules against the exact per-hand best response."""
    labels = ["Maximize weak", "Maximize strong", "Keep a pair, then maximize weak"]
    labels.extend(f"Maximize strong with weak >= {floor}" for floor in range(1, 11))
    totals = {strategy: [[0, 0] for _ in labels] for strategy in BANKERS}
    optimal = dict.fromkeys(BANKERS, 0)
    same_best = 0
    denominator = comb(52, 4)
    for hand, weights in ranked_hands():
        multiplicity = 1
        for _, copies in weights:
            multiplicity *= comb(4, copies)
        splits, results = exact_results(hand, gong, ties)
        by_weak = sorted(range(len(splits)), key=lambda index: strongest_weak(splits[index]), reverse=True)
        by_strong = sorted(range(len(splits)), key=lambda index: splits[index], reverse=True)
        weak = by_weak[0]
        choices = [weak, by_strong[0], next((i for i in by_weak if splits[i][0] > 10), weak)]
        for floor in range(1, 11):
            choices.append(next((i for i in by_strong if splits[i][1] >= floor), weak))
        best_indices = []
        for strategy, rows in results.items():
            nets = [win - loss for win, _, loss in rows]
            best = max(nets)
            optimal[strategy] += multiplicity * best
            best_indices.append({i for i, net in enumerate(nets) if net == best})
            for index, choice in enumerate(choices):
                totals[strategy][index][0] += multiplicity * nets[choice]
                totals[strategy][index][1] += multiplicity * (nets[choice] == best)
        if best_indices[0] & best_indices[1]:
            same_best += multiplicity
    print(f"All {denominator:,} starting hands, weighted by physical cards")
    print(f"Gong {'on' if gong else 'off'} | ties: {ties}")
    print(f"A split is best against both bankers in {same_best / denominator:.2%} of hands.")
    joint_count = denominator * comb(48, 4)
    for strategy in BANKERS:
        print(f"\nBanker maximizes {strategy} | exact best-response EV {optimal[strategy] / joint_count:+.5f}")
        print(f"{'Player rule':38} {'EV':>9} {'Exact best':>10} {'EV gap':>9}")
        for label, (net, hits) in sorted(zip(labels, totals[strategy]), key=lambda row: -row[1][0]):
            gap = (optimal[strategy] - net) / joint_count
            print(f"{label:38} {net / joint_count:+9.5f} {hits / denominator:10.2%} {gap:9.5f}")
    print("\nThreshold rules fall back to maximizing the weak hand when the target is unreachable.")
    if gong:
        print("A threshold of 10 means the weak hand must be Gong or a pair.")


def parse_hand(tokens):
    ranks = [token.upper().replace("T", "10") for token in tokens]
    if len(ranks) != 4 or any(rank not in RANKS for rank in ranks):
        raise ValueError("Enter four ranks such as A 2 5 Q. Separate ranks with spaces or commas.")
    return tuple(sorted(RANKS.index(rank) for rank in ranks))


def add_rule_arguments(parser):
    parser.add_argument("--no-gong", action="store_true", help="Score 2 and 8 as zero.")
    parser.add_argument("--ties", choices=("banker", "push"), default="banker",
                        help="An equal side goes to the banker or makes the whole deal a push.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="command")
    calculator = actions.add_parser("hand", help="Calculate exact odds for one hand or start interactive mode.")
    calculator.add_argument("cards", nargs="*", help="Four card ranks, e.g. A 2 5 Q.")
    simulation = actions.add_parser("sim", help="Compare strategies on seeded random deals.")
    simulation.add_argument("--deals", type=int, default=1_000_000)
    simulation.add_argument("--seed", type=int, default=20261127)
    research = actions.add_parser("study", help="Check rule-of-thumb EV against exact optimal splits.")
    for action in (calculator, simulation, research):
        add_rule_arguments(action)
    for action in (calculator, simulation):
        action.add_argument("--banker", choices=BANKERS, default="weak")
    args = parser.parse_args()
    if args.command is None:
        args = parser.parse_args(["hand"])
    if args.command == "sim":
        if args.deals < 1:
            parser.error("--deals must be positive")
        simulate(args.deals, args.seed, args.banker, not args.no_gong, args.ties)
    elif args.command == "study":
        study(not args.no_gong, args.ties)
    elif args.cards:
        try:
            hand = parse_hand(" ".join(args.cards).replace(",", " ").split())
        except ValueError as error:
            parser.error(str(error))
        display_hand(hand, not args.no_gong, args.ties, args.banker)
    else:
        print("Enter four ranks such as A 2 5 Q. Press Enter on a blank line to quit.")
        while True:
            try:
                line = input("\nCards > ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break
            if not line:
                break
            try:
                hand = parse_hand(line.replace(",", " ").split())
            except ValueError as error:
                print(error)
                continue
            display_hand(hand, not args.no_gong, args.ties, args.banker)


if __name__ == "__main__":
    main()

