# Si Ki Pi

A browser calculator and practice game for a Singapore CNY house-rule preset. It runs with static files and no dependencies.

## Preview on Windows

```powershell
git clone https://github.com/gosubay/sikipi.git
cd sikipi
python -m http.server 8000 --directory public
```

Open http://localhost:8000. To regenerate the findings with Node.js, run `node research.mjs`. The original Python calculator is available as `python si_ki_pi.py --help`.

## Cloudflare Pages

Import this GitHub repo in **Workers & Pages → Create application → Pages → Import an existing Git repository**. Use production branch `main`, framework preset **None**, build command `exit 0`, and build output directory `public`. Leave the root directory at its default.

## Format

Play by putting the weak hand on top and the strong hand below. The banker reveals after you lock in. The score is in points. Calculate compares all distinct splits. Findings compares two fixed banker strategies and an independent 50/50 mix, and reports paired 20- and 50-round simulations.

The default preset uses 2–8 Gong, banker-wins-ties, and even-money payouts. Rank-only scoring means suits do not enter the calculation. If the alternate tie rule is selected, equality on either side makes the entire round a push. Suit bonuses, Bobo, and Jin Gang payouts are outside this preset.

