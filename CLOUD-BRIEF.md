# Cloud runs: how to work on the Lennify Arcade

This repo is a set of browser games for phones (GitHub Pages: https://lennify44.github.io/rooftop-roulette/).
Scheduled cloud runs improve them while the owner is away. Each run: take the first open task in
`CLOUD-QUEUE.md`, finish it properly, test it, push it, tick it off.

## Who the games are for
Competent 15-year-olds. The owner's verdict on what works: **Rooftop Roulette is the best game here because it is
action, it gets faster and it is challenging.** What players missed in the other games: dopamine (rewards every few
seconds), visual feedback, pressure. "Stop making autorunners." Quality over quantity. Humour welcome; no stereotypes,
nothing sexist or gendered; characters anyone can be.

## The bar for every change
- Something happens within 3 seconds of pressing Play; one line of instructions at most.
- Colourful and big: saturated colours, depth, outlined shapes, the player at least ~8 % of the screen height in
  portrait; the game fills the screen in portrait (390×844) and landscape (844×390).
- Feedback on everything: screen shake and a short freeze on hits, particles, score pop-ups, combo/streak counters with
  calls ("RAMPAGE!"), a sound for every action (WebAudio synth, no audio files).
- Difficulty rises during a run; a first run ends within 1–2 minutes, good players last much longer; skill decides.
- Touch only, buttons ≥ 44 px, sound + mute, never change controls during a game.

## How the repo works
- Each game is `<folder>/index.html`, one self-contained file (inline CSS/JS, no build step needed to run it).
- **Only edit between `<!-- source:head -->` … `<!-- /source:head -->` and `<!-- source:body -->` …
  `<!-- /source:body -->`.** The rest of each page is a generated shell (meta tags, manifest, `feedback.js`);
  a sync on the owner's server copies the marked parts back to the master copies, so edits outside them are lost.
- `arcade/index.html` is the game browser: an `ART` map (SVG card art) and a `GAMES` list. Every game page keeps its
  "All games" link (`a[data-hub]`) to `https://lennify44.github.io/rooftop-roulette/arcade/`.
- Leaderboards: a shared Cloudflare Worker (`LEADERBOARD_URL` in each game). It only accepts game ids it knows, and it
  is deployed from the owner's server, not from here. Never change `worker/`. A new game that needs a board: pick a
  short id, write the client code like the other games, and add a line to `HOST-TODO.md` ("register board `x`:
  maxScore …, maxDist …"); until then it simply shows "could not reach the leaderboard".
- A new game: copy an existing page (for example `skybreaker/index.html` and its `manifest.webmanifest`), replace the
  content between the markers, fix title/manifest names, add an Arcade card, and add "add page `<folder>` to PAGES"
  to `HOST-TODO.md`.
- `feedback.js` (shared) adds the 💬 Feedback button to every page. Leave it alone.

## Test like a player before every push
- Serve the repo: `python3 -m http.server 8000` and open pages with Playwright/Chromium at 390×844 (mobile, touch) and
  844×390. Take screenshots of the start screen, early play, an intense moment and the end screen, and **look at them**.
- Play with simulated input (taps on the canvas halves, clicks on buttons) for at least 30 s; there must be no console
  errors or page errors. For balance, a simple scripted player is enough: random tapping must score lowest.
- Commit as the repo owner: `git -c user.name=Lennify44 -c user.email=138158501+Lennify44@users.noreply.github.com
  commit …`, a clear message, ending with `Co-Authored-By: Claude <noreply@anthropic.com>`. Then `git pull --rebase`
  and `git push origin main`. If the push is rejected, pull/rebase again and retry.

## Rules
- **Claim before you start:** change your task's `- [ ]` to `- [~] (in progress since <UTC date time>)`, commit and push
  that one line right away. Skip tasks marked `[~]` that were claimed less than 3 hours ago (another run is on them);
  an older claim is stale, take it over. When done, turn `[~]` into `[x]` with the date and summary.
- One task per run, done well. If a task is too big for one run, finish a playable part, push it, and split the rest
  into new unticked sub-tasks right below it.
- Tick the task in `CLOUD-QUEUE.md` with the date and one line on what changed.
- No secrets, no new external services or libraries from CDNs other than the fonts already used, no tracking.
- Never delete a game or a leaderboard. Keep Room 404 bilingual (all text in both `TXT.en` and `TXT.de`).
