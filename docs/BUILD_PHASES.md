# DATA SURVIVOR — Build Phases & Test Cases

## Status (Saturday 10 October, night)

| Phase | Status | Evidence |
|---|---|---|
| 1 Foundation | ✅ Done | F1–F5 pass; clean-clone build verified |
| 2 Game engine | ✅ Done | E1–E32 pass; 2,000 simulated games; 5 injected bugs all caught |
| 3 Realtime | ✅ Done | R1–R17 pass (real sockets, incl. polling-only and backup/restore) |
| 4 Screens | ✅ Done (automated part) | U1–U7 pass in real Chrome: host + 1080p and 4:3 projectors + 3 phones, full game, refresh, offline recovery |
| 5 Data moments | ✅ Done | A1–A11 pass. Prediction and pattern use shuffle checks; false-alarm rate measured at 5/100 |
| 6 Wrapped | ✅ Done (automated part) | W1–W3 pass; share card renders in e2e |
| 7 Load | ✅ Passed locally | 500 bots: 0 lost/duplicated answers in 7,331; late answers all rejected; 233 reconnects; p95 scene change 545 ms; lag 42 ms |
| 9 Visual upgrade | ✅ Done | V1–V11 pass: 78 unit tests, both e2e tests (all new charts visible), phone bundle 99.7 KB; 500-bot swarm rerun: 0 lost in 7,371, p95 251 ms, lag 25 ms |
| 8 Deploy & rehearsal | ⏳ Needs people | Deploy (DEPLOY.md), rerun the swarm on the real URL, real-device checks (U8, W4–W5, D3–D4), rehearsal (RUNBOOK.md) |

**Still manual (cannot be automated here):**
- U8: real iPhone/Android and in-app browsers.
- W4–W5: the share sheet on real phones.
- D2: the load test on the real host.
- D3–D5: campus Wi-Fi, the projector laptop, and the rehearsal.

**Change made while building:** the room map shows at most **3** groups, not 4. Only 3 colours stay colour-blind-safe as scatter dots on the dark background (checked with the dataviz palette validator).

## Development method: Test-Driven Development (TDD)

**No production code is written before its test.** Every phase follows the same loop:

1. **Spec:** the test cases are designed in this document first (IDs like `E6`), with input and expected result.
2. **Red:** the tests are written as code. They are run and seen to **fail**, and the failing tests are committed (`test(phaseN): ...`).
3. **Green:** the smallest code that makes them pass is written, then committed (`feat(phaseN): ...`).
4. **Refactor:** the code is cleaned up while the tests stay green.
5. **Gate:** the phase is done only when **all** its tests pass, it is committed, and it has been tried by hand. The next phase starts only after that.

**Traceability:** every automated test is named with its ID (e.g. `it("E6: equal scores are broken by faster answer time")`), so `npm test` output maps 1:1 to this document. If a bug is found later, a **new test that reproduces it is added first**, then the bug is fixed.

**Test types:**

| Type | Tool | Used for |
|---|---|---|
| Unit | Vitest | Pure logic: scoring, ranking, analytics, config |
| Integration | Vitest + real Socket.IO clients | Server + network behaviour on a local port |
| End-to-end | Playwright | Real browsers playing a full game |
| Load | Bot swarm script | 500 simulated phones on the deployed URL |
| Manual checklist | A written checklist, ticked off by a person | Real devices, venue, rehearsal. These checklists are also written **before** the feature. |

| Phase | Builds | Tests | When |
|---|---|---|---|
| 1 | Foundation | F1–F5 | Sat night |
| 2 | Game engine (pure logic) | E1–E32 | Sat night |
| 3 | Realtime layer | R1–R16 | Sat night / Sun early |
| 4 | Screens (phone, projector, host) | U1–U8 | Sun morning |
| 5 | Analytics + data moments | A1–A11 | Sun morning–midday |
| 6 | Wrapped + recap | W1–W7 | Sun midday |
| 7 | Hardening + load | L1–L9 | Sun ~3 pm |
| 8 | Deploy, rehearsal, event | D1–D7 | Sun 5 pm → Mon |

---

## Phase 1 — Foundation

**Builds:**
- Repo structure and shared types.
- The question bank.
- Config loading.
- An HTTP server that serves `/`, `/screen` and `/host`, plus a `/health` endpoint.
- A `Dockerfile`.

| ID | Type | Test | Expected |
|---|---|---|---|
| F1a | Unit | Count dilemma questions per round | 12 in total, exactly 3 in each of rounds 1–4 |
| F1b | Unit | Options on every dilemma question | Exactly 4, keys `A B C D` in order, non-empty text, each with a Wrapped tag |
| F1c | Unit | Finale questions | 3 scored + 1 tie-breaker. Each has 4 options and an answer key in the **server** key file |
| F1d | Unit | Question IDs | All unique |
| F2a | Unit | Shared question objects (sent to browsers) | Contain no `answer` / `correct` field |
| F2b | Unit | Every file in `web/` | Never imports from `server/` |
| F2c | Script | Built website files (`dist/web`) | Do not contain the secret marker string from the server key file |
| F3a | Unit | `loadConfig({})` (no `HOST_PASSWORD`) | Throws a clear error |
| F3b | Unit | `HOST_PASSWORD` shorter than 8 characters | Throws |
| F3c | Unit | Valid env | Returns config with port defaulting to 3000 |
| F4a | Integration | `GET /health` | 200, `{ ok: true }` |
| F4b | Integration | `GET /`, `/screen`, `/host` | 200 HTML. Each serves its own page (play / screen / host) |
| F4c | Integration | `GET /does-not-exist.js` | 404, not the HTML page |
| F5 | Script | `npm ci && npm run build && npm run verify` on a clean copy | Succeeds. This is exactly what the leads run. |

## Phase 2 — Game engine (pure logic, no network)

**Builds:**
- The `Game` class with an injectable clock, so tests control time.
- The scene sequence.
- Answer storage.
- Rarity scoring, ranking and survivors.
- Analyst Mode.
- Finale scoring and winners.
- Snapshot/restore.

**Design decision made while writing the specs:** the tie-breaker question is **always asked** as the 4th finale question (a "bonus speed question"). It only counts when finalists are tied. This avoids a conditional branch on stage.

**Scene order:**
`lobby → q1 → q2 → q3 → results(R1) → survivors(R1) → moment(R1) → … round 4 … → finale_intro → f1 → f2 → f3 → tb → finale_results → winners → recap → wrapped`

| ID | Test | Expected |
|---|---|---|
| | **Scoring** | |
| E1 | 10 answers on one question: A×5, B×3, C×2, D×0 | p(A) = 6/14, p(B) = 4/14, p(C) = 3/14. Scores are −ln(p), checked to 6 decimal places |
| E2 | An option with 0 picks | Finite share 1/(n+4). No `Infinity`/`NaN` anywhere |
| E3 | 200 random rooms (property test) | Every score ≥ 0. Shares (without smoothing) sum to 1 |
| E4 | A player skips one question in a round | That question scores 0.5 × the average score of players who answered it |
| E5 | 4 active + 4 eliminated players | Shares count all 8. The ranking lists only the 4 active players |
| | **Ranking & ties** | |
| E6 | Two active players with equal round scores | The one with the lower total answer time ranks higher |
| E7 | Equal score and equal time | Ordered by player ID. The same result over 100 repeated runs |
| E8 | Keep count ≥ number of active players | Everyone survives, no error |
| E9 | Keep count 0, negative, or not an integer | Rejected: `INVALID_CUTOFF` |
| E10 | Ranking at a cutoff of k | Reports `tiedAtCutoff` = how many players share the k-th player's exact score |
| | **Game state** | |
| E11 | An answer to a question that isn't open (wrong question, before open, after close) | Rejected: `NOT_OPEN` |
| E12 | Same player answers the same question twice (A, then B) | Stored once as **A**. The second reply says `duplicate: true` |
| E13 | Option `"E"`, `""`, `null` | Rejected: `INVALID_OPTION` |
| E14 | Analyst answers a dilemma | Stored and counted in shares, never ranked |
| E15 | Eliminated player | Never active again, including after a later lock |
| E16 | Joins before round 1 results vs after | Active vs Analyst (`late`) |
| E17 | `back()` into a closed question or results | Voting stays closed. Results and eliminations are not recomputed |
| E27 | `advance()` while voting is open | Closes voting (does **not** change scene). The next `advance()` changes scene |
| E28 | Timer: the clock passes `closesAt` | `tick()` closes voting. An answer at `closesAt + 1 ms` is rejected |
| E29 | `advance()` twice within 600 ms | The second call is rejected (`TOO_FAST`) |
| E30 | `advance()` from results to survivors without locking survivors | Rejected (`LOCK_REQUIRED`) |
| E31 | Pause and resume the timer | Remaining time is preserved across the pause, and answers are rejected while paused |
| E32 | `snapshot()` → `restore()` mid-game | The restored game is deep-equal and behaves identically |
| | **Finale** | |
| E18 | Finalists' ranking | Correct answers (f1–f3), then time on correct, then the tie-breaker being correct, then tie-breaker time, then ID |
| E19 | `lockWinners(25)` | Rejected. The maximum is 20 |
| E20 | An analyst answers the finale | Stored ("play along"), never in the ranking |
| | **Strange rooms** | |
| E21 | A full game with 1 player | Completes, with no errors |
| E22 | Everyone picks the same option | Equal scores, ties broken by time, no `NaN` |
| E23 | Everyone skips a question | Scores are 0 for that question, no `NaN` |
| E24 | 0 active players before finale | The finale has 0 finalists, winners are empty, no crash |
| | **Simulation** | |
| E25 | 1,000 simulated games each at n = 150 and n = 400, host locking the suggested cutoffs | Finalists = exactly min(20, active) every time. Winners = min(10, finalists) |
| E26 | "Sneaky bot" (picks the option it expects to be rarest) vs random bot | **Report only:** survival rate to the finale over 1,000 games, printed for the leads |

## Phase 3 — Realtime layer (Socket.IO)

**Builds:**
- Join/rejoin and the server timer.
- Rooms (all / screen / host / one player).
- Throttled counts.
- Host login.
- Full-state sync on reconnect.
- Message validation and rate limits.
- Backup/Restore.

These run **automatically, using real socket clients** against a local server.

| ID | Test |
|---|---|
| R1 | Join returns a saved token + a 4-character rejoin code. |
| R2 | Reconnecting with the token gives the same player with the same status. |
| R3 | The rejoin code works, a wrong code is rejected, and codes are unique. |
| R4 | **Privacy:** every message a phone receives is checked, and none contain another player's answers or nickname. |
| R5 | **Privacy:** the projector never receives nicknames, except host-approved winners. |
| R6 | The server closes voting on time. An answer arriving 1 ms after close is rejected. |
| R7 | Two simultaneous submits from one player: exactly one is stored. |
| R8 | **No message storm:** during voting a phone receives only its own confirmation. Counts go to host/projector at most twice per second. |
| R9 | A wrong host password is rejected. A non-host sending host commands is ignored. |
| R10 | Garbage messages (wrong types, huge payloads, unknown events) are dropped, and the server keeps running. |
| R11 | A flood of 100 messages/second from one connection is throttled, with no crash. |
| R12 | The join cap and the host's "lock joining" both work. |
| R13 | Two host devices logged in at once stay in sync. |
| R14 | A double-pressed "next" moves only one scene. |
| R15 | Stopping the server, restarting it and clicking Restore gives the identical game. Phones return to the right scene. |
| R16 | A full game works with **WebSockets disabled** (HTTP fallback only), which is what happens on a restrictive campus network. |

## Phase 4 — Screens (P0 UI)

**Builds:**
- **Phone:** join, question, locked-in, result, eliminated, Analyst, waiting.
- **Projector:** lobby with QR, question + countdown, bars, survivors, winners.
- **Host dashboard.**

| ID | Test |
|---|---|
| U1 | **End-to-end** (automated browser): 1 host + 1 projector + 5 phones play a full game, checking every screen. |
| U2 | Phone screenshots at 360 px and 390 px width, plus large system font: no sideways scrolling, buttons ≥ 64 px. |
| U3 | Projector screenshots at **1024×768 (4:3)** and **1920×1080**: no text cut off. |
| U4 | Refreshing any screen in every scene returns to the same scene. |
| U5 | Phone goes offline and back online (like locking the screen): it recovers. |
| U6 | The phone page stays ≤ 150 KB gzipped. The build fails if it's over. |
| U7 | Long nicknames, emoji and odd characters don't break any layout. |
| U8 | **By hand on real devices:** iPhone Safari, Android Chrome, Samsung Internet, and the Instagram/WhatsApp/Google Lens in-app browsers. |

## Phase 5 — Analytics + data moments

**Builds:**
- The four calculations.
- Their projector scenes.
- Phone personal cards.
- Fallback images.

| ID | Test |
|---|---|
| A1 | Spread: shares sum to 100%. The split labels (even / leaning / strong favourite) fire at the right thresholds. |
| A2 | Patterns: "× as likely" matches a hand-checked table. Random data shows "no strong pattern". Groups < 5 are never reported. |
| A3 | Groups: the same seed gives the same map. 2–4 groups are found, or "no clear groups" is shown. Groups < 5 are hidden. |
| A4 | Prediction: a player's **own answer is never used** to guess them (a test dataset where leaking would give 100% accuracy). The lazy baseline is correct. |
| A5 | Below minimum sizes (20 / 40 / 60), the chart is replaced by a plain fallback message. |
| A6 | **All 7 audience scenarios × 4 moments = 28 cases** produce valid output. |
| A7 | All four calculations together take under 3 s at n = 500 (expected under 0.1 s). |
| A8 | **Privacy:** data-moment messages carry no IDs or nicknames. Phones get only their own dot. |
| A9 | Wording check: never "causes", and "n = …" is always shown. |
| A10 | Screenshot of every scene in every scenario, reviewed by eye. |
| A11 | A forced calculation failure shows "use fallback" to the host, and **F** shows the image. |

## Phase 6 — Wrapped + recap

| ID | Test |
|---|---|
| W1 | Every card shows correct numbers for a hand-made player. |
| W2 | Label rules: a clear winner gets that label, a near-tie gets "A bit of everything". |
| W3 | A player who skipped a lot, joined late, or was eliminated in round 1 still gets a sensible Wrapped. |
| W4 | The share image renders at 1080×1920 with the right fonts on iPhone and Android. |
| W5 | If sharing isn't supported, the "long-press to save" fallback is shown. |
| W6 | With the nickname toggle off, the nickname is absent from the image. |
| W7 | Recap thumbnails show the real round results. |

## Phase 7 — Hardening + load (against the **deployed** URL)

| ID | Test |
|---|---|
| L1 | 500 bots join within 60 s. |
| L2 | All answer within 20 s, with 10% double-tap, 10% disconnect/reconnect and 5% late. |
| L3 | **0 lost and 0 duplicated answers.** Every bot's state matches the server. |
| L4 | Scene changes reach 95% of phones in under 1 s. |
| L5 | Server CPU and memory stay within limits. |
| L6 | 50 malicious bots (floods, garbage, host-command attempts) are rejected, and the game is unaffected. |
| L7 | Projector + host refresh during load. |
| L8 | Server restart mid-game + Restore while under load. |
| L9 | Bots with slow-network delays (3G-like). |

## Phase 8 — Deploy, rehearsal, event

| ID | Test |
|---|---|
| D1 | Quick automatic check of the leads' URL: health + a mini game. |
| D2 | L1–L9 rerun on the leads' real hosting. |
| D3 | Real phones on **campus Wi-Fi and on mobile data**. |
| D4 | Projector laptop: resolution, 4:3, full screen, smooth animation. |
| D5 | Rehearsal with 20–40 club members + bots, timed. |
| D6 | Go/No-Go checklist (EXECUTION_PLAN §8.5). |
| D7 | Final reset on Monday: watermark gone, 0 players. **No deploys after this.** |

## Phase 9 — Visual upgrade (Sunday)

**Goal:** more charts on the projector and in Wrapped, and a typography, colour and spacing refresh, **without changing game behaviour**. All earlier tests must still pass.

New data the server sends (aggregates only — privacy rules unchanged):

| ID | Type | Test | Expected |
|---|---|---|---|
| V1 | Unit | `game.roundDistribution(r)` after locking | `scores` = every player active before the lock; `survivorScores` = the kept players; `cutoff` = lowest survivor score |
| V2 | Integration | Projector at the survivors scene | `survivors.histogram` has 10 bins; bins sum to the players active before the lock, `kept` sums to the survivors; no player IDs |
| V3 | Integration | Recap scene | Projector gets `recap` with 4 data-moment summaries; phones do **not** get it (keeps phone messages small) |
| V4 | Integration | Phone results card | Each answered item has `dist` (% per option) summing to 98–102 |
| V5 | Unit | Wrapped `rarest.dist` | % per option for the rarest question, sums to 98–102, and includes the player's option |
| V6 | Unit | Wrapped `timeline` | 12 entries in question order: `with` / `against` / `skip`, matching `againstMajority` |
| V7 | Unit | Wrapped `tags` | Tag counts sum to the number of questions answered |
| V8 | Unit | Wrapped `rounds` | 4 entries; `me` and `room` are 0–100 or `me` = null for a round with no answers; no NaN |
| V9 | E2E | Projector shows the new charts | Lobby join dots, question answer meter, survivors histogram, recap thumbnails are visible |
| V10 | E2E | Phone shows the new charts | Results mini-bars; Wrapped distribution, timeline, rounds and tag charts are visible |
| V11 | Regression | Everything from Phases 1–7 | All earlier tests pass; the 500-bot load test still passes |

## Phase 10 — Small rooms (event morning)

**Goal:** the turnout may be anywhere from 20 to 200, so all four data moments must draw a real chart for any room of **5 or more** people (the minimum stays at 5 for privacy: smaller groups are never shown). Patterns keeps its inner safety rules (a combination needs ≥ 5 people), so a small room may honestly show "No strong patterns".

| ID | Type | Test | Expected |
|---|---|---|---|
| S1 | Unit | `MIN_N` | 5 for spread, pattern, groups and prediction. Rooms of 1–4 return `too_few`. |
| S2 | Unit | Every room size from 5 to 60, every audience scenario, all 4 moments, plus every player's personal card | No error, never `too_few`, no `NaN`/`Infinity` in any payload, no player IDs in moment payloads |
| S3 | Integration | A full live game with **20 players** | The projector receives all four moments (spread, pattern, groups, prediction), none `too_few`; every phone gets its Wrapped |
| S4 | Regression | Everything from Phases 1–9 | All earlier tests pass (A5 and A10 updated to the new minimum); the load test still passes |
