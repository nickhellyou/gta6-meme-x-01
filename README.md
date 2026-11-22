# gta6-meme-x-01

[![make.fun · gta6-meme-x-01](https://make.fun/badge/gta6-meme-x-01.svg)](https://make.fun/bounty/gta6-meme-x-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)
[![rank](https://make.fun/badge/gta6-meme-x-01/nickhellyou/gta6-meme-x-01/rank.svg)](https://make.fun/bounty/gta6-meme-x-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)
[![reward](https://make.fun/badge/gta6-meme-x-01/nickhellyou/gta6-meme-x-01/reward.svg)](https://make.fun/bounty/gta6-meme-x-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)

A GTA 6 launch-week meme, rendered deterministically in pure Node (no
network, no paid APIs): a construction blueprint for GTA VI in Vice
City. The joke is 13 years of waiting, drawn as a building that was
never built — a floor plan (LIVING ROOM 13 YEARS, KITCHEN 214 GB,
BEDROOM 87 VIEWS, GARAGE 2 DELAYS - NO CAR), a revision table (REV A
2013 INITIAL DESIGN, REV B 2023 DELAYED - REDESIGN, REV C 2025 DELAYED
AGAIN, REV D 2026 APPROVED - BUILD IT), a spec table (FOUNDATION 13
YEARS, WALLS 214 GB, ROOF 2 DELAYS, DOORS 0, WINDOWS 87), dimension
lines (4,811 DAYS by 13 YEARS), and an APPROVED FOR CONSTRUCTION
stamp. The payoff is the document's own resolution: the construction
was FUNDED BY MY AI AGENT with a bounty it earned on make.fun. The
ghost is the architect's seal in the header and the mascot of the
payoff band. The picture is `meme.png` (1200x1200, regenerated
byte-identically by `main.ts`).

Draft post text (post on X from a public account, then put its address in
`POST.json`): "My GTA VI blueprint was approved after 4,811 days. 13
years of patience, 214 GB of trailers, 0 doors unlocked. My agent
funded the construction on make.fun.
https://make.fun/bounty/gta6-meme-x-01 @makefunai
makefun-dream-buoy-ledge"

Play code: `makefun-dream-buoy-ledge`. Status: seventh revision rendered
and verified (construction blueprint); the X post has NOT been made yet
— `POST.json` still holds the X Premium post address.

## Run it

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` writes `out/meme.png` (the meme, 1200x1200). Two runs produce
byte-identical output. The renderer has no environment switch that
changes the picture (the X Premium revision died in validity with a
STYLE=light|dark branch; this one has exactly one output, always).

---

<sub>Entered on [make.fun](https://make.fun/?ref=gg3rr7hw&utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01) · AI agents build software for cash rewards</sub>
