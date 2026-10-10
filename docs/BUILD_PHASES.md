# DATA SURVIVOR — Build Phases & Test Cases

**Rule:** a phase is done only when **all its tests pass**, the work is committed, and the phase has been tried by hand on a real phone. The next phase starts only after that.

| Phase | Builds | Tests | When |
|---|---|---|---|
| 1 | Foundation | F1–F5 | Sat night |
| 2 | Game engine (pure logic) | E1–E26 | Sat night |
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
- A server that starts and serves `/`, `/screen` and `/host`.
- A `/health` check endpoint.
- A `Dockerfile`.

| ID | Test |
|---|---|
| F1 | Question bank: 12 dilemma questions, each with exactly 4 options. Rounds 1–4 have 3 questions each. Finale questions have answer keys. All IDs are unique. |
| F2 | Finale answer keys **do not appear** anywhere in the built website files (scanned automatically). |
| F3 | The server refuses to start without `HOST_PASSWORD`. |
| F4 | `/health` returns OK, and all three pages load. |
| F5 | A clean install + build from scratch works (exactly what the leads will do). |

## Phase 2 — Game engine (pure logic, no network)

**Builds:**
- Scene sequence (state machine).
- Answer storage.
- Rarity scoring, ranking and survivors.
- Analyst Mode.
- Finale scoring and winners.

| ID | Test |
|---|---|
| | **Scoring** |
| E1 | Rarity score matches a hand-calculated example. |
| E2 | An option nobody picked still gives a finite score (smoothing works). |
| E3 | Scores are never negative. |
| E4 | A skipped question scores half the room's average, so skipping never helps. |
| E5 | Shares use all players, but only active players are ranked. |
| | **Ranking & ties** |
| E6 | Equal scores are broken by faster answer time. |
| E7 | Equal score **and** equal time gives the same order every run. |
| E8 | A cutoff larger than the number of active players means everyone survives, with no crash. |
| E9 | A cutoff of 0 or a negative cutoff is rejected. |
| E10 | The host is told how many players are tied at the cutoff. |
| | **Game state** |
| E11 | Answers are accepted only for the currently open question. |
| E12 | A duplicate answer is stored once. The first tap is locked in. |
| E13 | An invalid option (e.g. "E" or "") is rejected. |
| E14 | Analyst answers are stored and counted in charts but never ranked. |
| E15 | An eliminated player can never become active again. |
| E16 | Joining after round 1 closes means Analyst Mode. |
| E17 | Scenes move only in the legal order. "Back" never recomputes or re-eliminates. |
| | **Finale** |
| E18 | Ranking is by correct answers, then time, then the tie-breaker. |
| E19 | Winners never exceed 20. |
| E20 | Analyst finale answers are never ranked. |
| | **Strange rooms** |
| E21 | A room with 1 player. |
| E22 | Everyone picks the same option. |
| E23 | Everyone skips. |
| E24 | 0 active players left. |
| | **Simulation** |
| E25 | 10,000 simulated games at n = 150 and n = 400 keep finalist counts in the target range. |
| E26 | "Sneaky bot" (always picks the rarest option) and random bot: report how far each gets. |

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
