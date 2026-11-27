# Si Ki Pi

A browser calculator, practice game, and strategy study for a Singapore CNY Si Ki Pi preset.

## Play online

Open [Si Ki Pi](https://gosubay.github.io/sikipi/). This repository uses GitHub Pages with **Deploy from a branch → main → /docs**.

## Preview locally

```powershell
git clone https://github.com/gosubay/sikipi.git
cd sikipi
python -m http.server 8000 --directory docs
```

Open http://localhost:8000. To regenerate the findings, run `node research.mjs` from the repo root. To use the Python terminal calculator, run `python si_ki_pi.py --help`.

In Play, put the weak hand on top and the strong hand below. Calculate ranks the possible splits by expected points. Findings compares two fixed banker strategies and their 50/50 mix, plus paired 20- and 50-round simulations.

The default preset uses 2–8 Gong, banker-wins-ties, and even-money points. With the alternate tie rule, equality on either side makes the round a push. The preset scores ranks and excludes suit bonuses, Bobo, and Jin Gang payouts.
