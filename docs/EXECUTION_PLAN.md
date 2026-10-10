# DATA SURVIVOR — Understanding & Execution Plan (v2, reviewed)

**Event:** Orientation, Monday 12 October 2026
**Plan written:** Saturday 10 October 2026 (about 40 hours before the event)
**Expected audience:** up to 400 students on their own phones. **We design and test for 500.**
**Source proposal:** [PROPOSAL_v3.md](PROPOSAL_v3.md)
**Hosting:** done by the club leads, following `docs/DEPLOY.md`

---

## 0. Review log: what changed from v1 and why

v1 was reviewed as if it were someone else's design for a live event. These are the problems found and how they are fixed. Section numbers refer to this document.

| # | Severity | Problem in v1 | Fix (where) |
|---|---|---|---|
| 1 | 🔴 Critical | **Tied scores could blow up the finalist count.** Players with identical answers get identical scores. With only 64 possible answer combinations per round, a block of 15 tied players at the cutoff is likely, and "all ties survive" turns 20 finalists into 35. | Ties are broken by **answer speed** in that round (pre-announced). The host sees the tie block before locking and can override. (§5) |
| 2 | 🔴 Critical | **Message storm.** If the server pushed an update to every screen on every answer, 400 answers would create 160,000 messages in 20 seconds. | Answer counts go **only to the host and projector**, at most twice per second. Phones receive nothing during voting except their own confirmation. (§3) |
| 3 | 🔴 Critical | **The crash recovery didn't work on typical hosts.** Most hosting platforms wipe the disk on every restart or redeploy, so v1's "snapshot to disk" saved nothing. | The **host browser keeps a backup** (primary recovery), with a disk snapshot as a bonus where the host keeps files. Strict rules: **one instance only, autoscaling off, no deploys after the final reset.** (§3, §10) |
| 4 | 🔴 Critical | **Abuse by students.** 400 engineering students includes someone who will script 5,000 fake joins, spam answers, or open `/host`. | Join cap, join lock, a strict validator on every message, per-connection rate limits, host password from server config, and finale answer keys kept on the server only. (§3.4) |
| 5 | 🟠 High | **Phone clocks are wrong.** A phone 30 seconds off would show a broken countdown. | The server sends **"milliseconds remaining"**, never a clock time. The server alone decides when voting closes. (§3) |
| 6 | 🟠 High | **Projector hardware is unknown.** Projectors are often old (4:3 aspect, 1024×768) and run on a weak college laptop. Animating 400 dots as separate React components may stutter. | Layouts for 4:3 and 16:9. The room map is drawn on **Canvas**, and animations use only GPU-friendly properties. Tested on the actual projector laptop. (§7) |
| 7 | 🟠 High | **Lost identity.** Phones that open the QR link in Instagram, Google Lens or private mode can lose their saved ID, so the player would rejoin as a stranger and lose their survival status. | Each player gets a **4-character rejoin code** on their screen ("Your code: K7QX") to type back in. (§3) |
| 8 | 🟠 High | **The campus network may block WebSockets** (firewall or captive portal). | Socket.IO's HTTP fallback stays **on**. Fonts are bundled locally, with no Google Fonts call. Test on the campus network itself. (§3, §8) |
| 9 | 🟠 High | **The data moment might not be ready on cue.** If calculation starts only when the host presses "show", the projector sits blank. | Calculation starts **as soon as voting closes**, while Results/Survivors are on screen. The scene can't start until results are ready. After 3 seconds, the host is offered the fallback image. (§3) |
| 10 | 🟠 High | **Accidental key presses on stage.** Pressing Space twice skips a scene, and Reset during the game would wipe it. | Scene changes are rate-limited (one per 600 ms). Destructive actions (lock survivors, reset, end game) need a confirmation. On-screen buttons work as well as keys. (§3.3) |
| 11 | 🟡 Medium | **No rule for late joiners**, who would break round 1 scoring. | Joining as an active player is allowed until round 1 voting closes. After that, new joiners enter Analyst Mode. (§5) |
| 12 | 🟡 Medium | **Phones would download the projector code** (heavy animation library) for nothing. | Separate bundles per screen. The phone bundle stays at or below 150 KB gzipped. (§3) |
| 13 | 🟡 Medium | **The share image could fail on iPhone.** HTML-to-image libraries often drop fonts on Safari, and in-app browsers lack Web Share. | The image is drawn directly with Canvas. If sharing isn't supported, "long-press to save image" is shown instead. (§6) |
| 14 | 🟡 Medium | **Single host device.** If the host laptop dies, nobody can advance the game. | **Two host sessions** can be logged in at the same time (main + backup phone). (§3.3) |
| 15 | 🟡 Medium | **Unclear deploy owner.** I can't load test until the leads deploy. | Leads deploy a **first version by Sunday 11 am**. The schedule depends on this. (§9) |
| 16 | 🟢 Low | Analyst players' role in the finale wasn't defined. | They can play the finale for fun ("Play along") but are never ranked. (§5) |

**Verified vendor facts (10 Oct 2026):**
- Supabase free realtime limit is **200 concurrent connections**, which confirms we shouldn't use it.
- Free hosting tiers commonly sleep when idle and lose files on restart. For example, Render's free tier sleeps after 15 minutes without traffic. Our design tolerates this: the open projector keeps the server awake, and the host backup covers restarts.
- The app is small: under 100 MB of RAM and about 0.3 GB of bandwidth for the whole event.

---

## 1. What we are building

Students scan a QR code and enter a nickname. They answer dilemma questions on their phones, and the projector shows what the room chose.

- **4 rounds × 3 questions**, 4 options each, no right answers. The less common your answers, the higher your **rarity score**. The top N players survive.
- **Eliminated players** go to **Analyst Mode**. They keep answering and their answers still feed the charts, but they can't win.
- After each round there is a **data moment** on the projector built from the real answers:
  1. **Spread:** how split was the room?
  2. **Patterns:** which answers go together?
  3. **Groups:** a map of the room, one dot per person
  4. **Prediction:** can a computer guess your answer better than a lazy guess?
- **Finale:** about 20 finalists, 3 objective questions plus a tie-breaker, **10 winners** (hard cap 20).
- **Ending:** a "Room Decoded" recap on the projector, then a personal **Wrapped story** on every phone.

| URL | Who | Device |
|---|---|---|
| `/` | Every student | Phone |
| `/screen` | Projector | Laptop on HDMI |
| `/host` | Presenter + tech team (password) | Laptop/tablet + backup phone |

---

## 2. Guiding constraint

There are 2 days, not 6 weeks. That means:
1. **The fewest moving parts.** One server, one URL, no database service.
2. **Testing is booked in the schedule** and never squeezed.
3. **Scope comes in tiers (§4).** When time runs short, the lowest tier goes. Testing never does.

---

## 3. Architecture

```
 Phones (≤500) ──┐
 Projector ──────┼── Socket.IO (WebSocket, with HTTP fallback) ──►  ONE Node.js process
 Host ×2 ────────┘                                                  ├─ game state in memory (single source of truth)
                                                                    ├─ scoring + analytics
                                                                    └─ serves the website files
```

### 3.1 Stack

| Layer | Choice |
|---|---|
| Server | Node 22 + TypeScript + Express + Socket.IO |
| Validation | `zod` schema on **every** incoming message |
| Frontend | Vite + React + TypeScript + Tailwind, **one separate bundle per screen** |
| Animation | Framer Motion (projector only). The phone uses CSS transitions. |
| Charts | Hand-written SVG (bars, ribbons) + **Canvas** (room map, 500 dots) |
| Analytics | Plain TypeScript: our own PCA, k-means and k-nearest-neighbours with fixed random seeds. The data is about 500×48 numbers, so it takes milliseconds. |
| Tests | Vitest (logic) + bot swarm script (load) |
| Hosting | **Chosen and run by the club leads, at no cost to us.** Requirements are in §12.1. A `Dockerfile` and plain `npm start` are included so it runs on any provider. |

### 3.2 Core rules (these are what prevent failures)

1. **The server owns all truth:** scene, timer, scores, survivors. Clients only display it.
2. **Draw from snapshot.** On every connect or reconnect, the client gets the full state it is allowed to see and draws it. Refreshing any screen is always safe.
3. **Answers are idempotent.** One answer per player per question, so a second tap just returns the stored answer. Answers count only if the question is open, the player is allowed to answer it, and the option is valid.
4. **Timer as remaining time.** The server sends `msRemaining`. Phones count down locally from that and resync on every message. Voting closes **only** when the server's timer fires.
5. **Throttled updates.** During voting, only the host and projector receive the answered count, at most twice per second. Phones receive only their own confirmation.
6. **Precomputed data moments.** Analytics run the moment voting closes. Their status is `computing`, then `ready` or `failed`. The projector can only enter a data-moment scene when the status is `ready`, and otherwise the host is offered the fallback image.
7. **Messages are sorted into rooms:**
   - `all`: scene changes
   - `screen`: totals and charts
   - `host`: control data
   - `player:<id>`: personal results
   Raw answers never leave the server.
8. **Identity has a fallback.** A random token is saved on the phone, and a **4-character rejoin code** is shown on screen in case the token is lost.
9. **Node runs one thing at a time.** No two answers can ever be processed at the same moment, so there are no race conditions. This is a key reason to use one process.

### 3.3 Host controls

- Big on-screen buttons **and** keys: Space = next, ← = back, E = extras, F = fallback image, P = pause timer.
- Scene changes are rate-limited to one per 600 ms, so a double press does nothing.
- Confirm dialogs on: **Lock survivors**, **Reset game**, **End game**, **Reveal winners**.
- Two host sessions can be logged in at once, and both see the same live view.
- Before revealing winners, the host sees the list and can hide a nickname.
- The host browser saves a **backup of the full state every 5 seconds**. **Restore** pushes it back to a restarted server.
- **Manual override:** the host can type in the survivor count.

### 3.4 Security & abuse protection

| Threat | Protection |
|---|---|
| Someone opens `/host` | Password set in the hosting dashboard (never in code). Host messages need a signed session. |
| A script floods fake joins | Hard cap of 800 players. The host can **lock joining**. Joins are rate-limited per connection. The cap is **not** per IP, because 400 phones on venue Wi-Fi share one IP address. |
| Answer spam / malformed messages | `zod` validation, per-connection rate limit, invalid messages dropped and logged. |
| Peeking at finale answers in the browser's code | Answer keys exist **only on the server** and are never sent before the reveal. |
| Offensive nicknames | 16-character limit, a profanity filter, and nicknames only ever shown on the projector after host approval (winners). |
| Script injection via nickname | React escapes text by default. Never use raw HTML. |
| Someone opens `/screen` on their own phone | Harmless: it shows only what the projector shows. |

### 3.5 Crash safety

| Situation | Effect | Recovery |
|---|---|---|
| A phone refreshes or loses signal | Nothing lost | Token or rejoin code restores it |
| Projector/host refresh | Nothing lost | Returns to the current scene |
| Server process crashes | Memory lost | Host clicks **Restore** (from the browser backup, ≤5 s old). Phones reconnect automatically. |
| Someone redeploys during the event | Same as a crash | **Rule: no deploys after Monday's final reset** |
| Hosting provider down | Game stops | Paper/Google Form fallback (§10) |

---

## 4. Scope tiers

| Tier | Content | If time runs out |
|---|---|---|
| **P0: the game works** | Join + rejoin code, 12 questions, server timer, host controls, projector question + bars, rarity scoring + tie-break, survivors, Analyst Mode, finale + tie-breaker, winners, abuse protection, host backup/restore | Never cut |
| **P1: the wow** | Data Moment 1 (Spread) + 4 (Prediction), phone personal cards, Wrapped story + share image, recap | Emergency cut only |
| **P2** | Data Moment 2 (ribbons), 3 (room map), "You are here" | Fallback: bar-only version |
| **P3** | Margin of error, shuffle-check badge, luck-check replay, "guess the popular option" tap, score histogram | First to go |

---

## 5. Game rules

### Rarity score
- Share of an option = `p = (count + 1) / (total + 4)`. The +1 smoothing stops a very small group from producing an extreme score.
- Per-question score = `−ln(p)`. Round score = mean of the 3 questions.
- Shares come from **all** players' answers. **Only active players are ranked.**
- **Skipped question:** the player gets half the room's average rarity for it, so skipping never pays.

### Ranking & ties (fixes review item 1)
Order: **round score**, then **faster total answer time in that round** (server-measured), then player ID as a last deterministic resort. The host is told in advance to say *"ties are broken by speed"*.
- The host screen shows the suggested cutoff **and** how many players have exactly the score at the cutoff. The host can move the cutoff before locking.

### Who can join, and when
- Players join as **active** until round 1 voting closes. After that they join in **Analyst Mode**.
- Analyst players can "play along" in the finale but are never ranked.

### Survivor targets (suggested; the host can change them)

| After | Keep | At 400 | At 150 |
|---|---|---|---|
| Round 1 | ~65% | ~260 | ~100 |
| Round 2 | ~60% | ~155 | ~60 |
| Round 3 | ~45% | ~70 | ~30 |
| Round 4 | fixed | **20 finalists** | 15–20 |
| Finale | fixed | **10 winners** (cap 20) | 5–10 |

### Finale ranking
The finale has 3 scored questions plus a **tie-breaker that is always asked** as the 4th ("bonus speed question"). This avoids a conditional branch on stage.

Ranking order:
1. Most correct answers on the 3 scored questions.
2. Least total server-measured time on correct answers.
3. The tie-breaker being correct.
4. Tie-breaker time.
5. Player ID.

### Known weakness
Always picking "the option that seems rarest" can game the rarity rule. Live counts stay hidden while voting is open.

**Measured (test E26, 1,000 simulated games, 150 players with real answer patterns + 2 bots):**

| Player | Reached the finale |
|---|---|
| Sneaky bot (knows the least popular option) | **99.9%** |
| Random bot (taps anything) | **60.6%** |
| Average real player | 13.2% |

In a room where people's answers follow patterns, random or contrarian answers are rare by definition. This is inherent to a minority game, not a bug.

**Why it's acceptable:**
- Rarity only gets players **into** the finale.
- **Winners are decided by the objective finale questions**, which can't be gamed this way.
- A real person can only *guess* the least popular option, while the bot knew it exactly.

**Leads to decide:** keep as is (recommended, and say on stage *"thinking differently gets you to the finale; knowing data wins it"*), or change the rule.

---

## 6. Wrapped summary (phone)

Story format: tap to advance, a progress bar at the top, one idea per card. Every card shows "Based on this room of n = X".

1. **Intro:** "12 questions. Here's what the room learned."
2. **Rarest choice:** "Only 7% (28 people) chose this."
3. **You vs the room:** "You went against the most popular answer on 7 of 12."
4. **Your place on the map:** a small map with your dot.
5. **Thinking style:** a playful label from option tags, plus the 3 answers behind it, or "A bit of everything".
6. **Share card:** a 1080×1920 image **drawn with Canvas**, shared via the Web Share button. If sharing isn't supported, "long-press to save" is shown. The nickname on the card is optional.

The option-to-tag mapping lives in `shared/` for the leads to review.

---

## 7. UI direction (not AI slop)

**Avoid:** purple-blue gradients everywhere, emoji in headings, cards nested in cards, small grey text, generic dashboards.

**Do:**
- **Theme:** near-black background, **one** club accent colour, and white type.
- **Option colours:** a fixed, colour-blind-safe A–D colour set, identical on phone and projector. B is always the same colour.
- **Type:** bold grotesque type, **bundled locally**. Numbers are huge, and there is one idea per screen.
- **Phone:**
  - Answer buttons are full-width and at least 64 px tall, with no scrolling during a question.
  - Readable in a dark hall at low brightness. Works at 360 px width and with large system fonts.
  - The tapped option stays clearly marked ("Locked in: B").
- **Projector:**
  - Question text at least 48 px, and **n = …** on every chart.
  - Layouts for **4:3 (1024×768) and 16:9 (1920×1080)**.
  - The map is drawn on Canvas, and animations use only `transform`/`opacity`, so they stay smooth on a weak laptop.
- **Motion:** bars grow, dots glide, cards slide. Nothing bounces for decoration.
- **Waiting screens:** show live-feeling copy ("312 people in the room") instead of a spinner.

**Needed:** club logo + colours. If we don't get them, a tasteful default goes in, easy to swap later.

---

## 8. Testing plan

**Method: Test-Driven Development.** For every feature:
1. The test cases are designed first, in [BUILD_PHASES.md](BUILD_PHASES.md), with IDs.
2. They are written as code and seen to fail.
3. Only then is the feature built, until they pass.

Test names carry their IDs, so `npm test` output maps 1:1 to the spec. Every bug found later gets a reproducing test before it is fixed. Manual checks (devices, venue, rehearsal) are written as checklists before the feature too.

### 8.1 Logic (Vitest)
- Rarity on hand-checked examples, shares summing to 100%, scores never negative, the same seed giving the same output.
- Edge cases:
  - 1 player
  - everyone picking the same option
  - all answers skipped
  - ties at the cutoff
  - late joiners
  - duplicate answers
  - answers after close
  - answers to the wrong question
- `simulateAudience(n, scenario, seed)` with all 7 scenarios from the proposal. Every data moment returns a valid result **or** a valid "no pattern" result.
- An elimination simulation at n = 150 and n = 400, checking finalist counts and the sneaky bot.

### 8.2 Load test (500-bot swarm, against the **deployed** URL)
- 500 bots join within 60 seconds and answer within 20 seconds.
- Included: 10% double-taps, 10% disconnect-and-reconnect mid-question, 5% late answers, plus 50 garbage/malicious messages.
- The projector and host refresh mid-round. A **server restart + host Restore** is tested once.
- **Pass:**
  - 0 lost and 0 duplicated answers
  - every bot's final state matches the server
  - CPU under 70%
  - phones see the scene change within 1 second

### 8.3 Devices & networks
- Browsers: Android Chrome (budget + flagship), iPhone Safari, Samsung Internet, and the **in-app browsers** of Instagram, WhatsApp and Google Lens.
- Phone settings: 360 px width, large system font, 3G throttling, screen lock and wake mid-question.
- **The campus Wi-Fi and the venue's projector laptop**, tested before the event.

### 8.4 Rehearsal (required)
20–40 club members on real phones, the real host and the real projector laptop, with the bot swarm adding about 400 more players. Timed with a stopwatch. A **SIMULATED DATA** watermark shows until the final reset.

### 8.5 Go / No-Go (Sunday night)
1. The 500-bot test passes on the deployed URL.
2. A rehearsal finishes within the planned time.
3. Refreshing any screen, and a server restart + Restore, both recover correctly.
4. No nickname appears on the projector except host-approved winners.
5. Every data moment has a fallback image, switched with F.
6. The abuse tests are rejected cleanly.

If an item fails, we cut P2/P3 until it passes.

---

## 9. Schedule

| When | What | Who |
|---|---|---|
| **Sat night** | Server, game engine, scoring + tests, phone join/answer, host controls, projector question + bars. `DEPLOY.md` written. | Me (Claude) |
| **Sat night** | Push the repo to GitHub, add the leads, and ask the leads to **deploy by Sun 11 am** | You |
| **Sun morning** | Data moments 1–4 + tests in all scenarios, Analyst Mode, finale, winners, abuse protection | Me; you test on your phone |
| **Sun 11 am** | First deploy live (leads). The URL is shared with us. | Leads |
| **Sun midday** | Wrapped + share image, recap, polish, fallback images | Me; you get logo/colours, leads check wording |
| **Sun ~3 pm** | **500-bot load test on the live URL** | Me + you |
| **Sun ~5 pm** | **Rehearsal** (real phones + bots) | Everyone |
| **Sun ~7 pm** | Fixes, **CODE FREEZE**, final deploy, Go/No-Go | Me + you + leads |
| **Sun night** | Print QR codes plus a short URL, host cheat-sheet, Google Form fallback ready, laptops charged | You + host |
| **Mon, 2 h before** | Venue check on the projector laptop + campus network. **Final reset.** After this: **no deploys.** | You + host |

**If the leads can't deploy by Sunday 3 pm,** we load-test against a temporary free deployment (or a tunnel from a laptop), so testing doesn't slip.

---

## 10. Event-day runbook (full version in `docs/RUNBOOK.md`)

**Before doors open:**
- Projector laptop: `/screen` in full screen (F11), **Do Not Disturb on**, sleep/screensaver off, browser zoom 100%, charger plugged in.
- Host: `/host` on the main device, with the backup host logged in on a phone.
- Open the server dashboard and confirm 1 instance is running.

**Host's first line:** *"If the Wi-Fi is slow, switch to mobile data."* The phone page is tiny, so 4G is fine.

**If something breaks:**

| Problem | Action |
|---|---|
| A few phones are stuck | "Refresh the page." If needed, they enter their rejoin code. |
| Projector frozen | Refresh `/screen`. |
| A data moment looks wrong or is late | Press **F** for the fallback image and say "here's what this looked like in rehearsal". |
| Server restarted | Host clicks **Restore**. |
| Total failure | Google Form + printed slides version, prepared Sunday night. |

---

## 11. Privacy

- Nickname only: no email, phone number or ID.
- Shown when joining: *"Your answers are anonymous and only used for live group charts. Data is deleted after the event."*
- Groups with fewer than 5 people are hidden, and no nicknames appear in any data moment.
- After the event: an optional export of anonymous totals, then the raw data is deleted. Restarting the server also wipes it.

---

## 12. Repository & access

- Private GitHub repo `data-survivor`. The club leads are added as collaborators. **Usernames needed.**
- Structure:

```
data-survivor/
  server/    engine, socket handlers, analytics, scoring
  web/       React: play, screen, host (separate bundles)
  shared/    questions, types, option tags (leads review)
  scripts/   bot swarm, audience simulator
  docs/      proposal, this plan, DEPLOY, RUNBOOK, host script
```

The GitHub CLI isn't installed. Either create an empty private repo on github.com and send me the URL, or run `winget install GitHub.cli` then `gh auth login`.

---

### 12.1 Hosting requirements for the leads

| Requirement | Why |
|---|---|
| Runs a **long-lived Node 22 process** (or Docker). **Not serverless-only platforms** like Vercel or Netlify Functions. | Serverless functions can't keep 400 live connections open. |
| **WebSockets** supported | Live updates. HTTP fallback works, but it's slower. |
| **Exactly one instance**, no autoscaling | Game state lives in one process's memory. |
| **HTTPS** URL | Needed for the phone Share button and for trust when people scan the QR. |
| Environment variable `HOST_PASSWORD` | Protects `/host`. |
| Doesn't sleep **during the event** | On free tiers that sleep, open `/screen` 15 min early. Its live connection keeps the server awake. |
| **No redeploys** after Monday's final reset | A redeploy restarts the server. |

### 12.2 Chosen hosting (₹0): primary + hot standby

**Final decision (same code everywhere, only settings differ):**

| Case | Primary | Standby |
|---|---|---|
| **A: AWS credits available** (preferred) | AWS EC2 `t3.small`, Mumbai | Railway |
| **B: AWS unavailable, Hostinger VPS available** | Hostinger VPS | Railway |
| **C: neither available** | Railway | Render free |

Decide by **Sunday 11 am**. Case C is deployed regardless, so it is always ready as a fallback.

Case C details:

| Role | Provider | Plan | Why |
|---|---|---|---|
| **Primary** | **Railway** (Singapore region) | Free trial: $5 one-time credit for 30 days, 1 GB RAM, shared vCPU, never sleeps | More CPU than other free tiers and no sleep. The event uses well under $1 of the credit. |
| **Standby** | **Render** (Singapore region) | Free: 512 MB RAM, 0.1 CPU, sleeps after 15 min without traffic | Same code, already running. Kept awake by opening its `/screen` before the event. |

**Failover:** if the primary dies mid-game, the host opens the standby's `/host` and clicks **Restore** (the state is in the host's browser). The projector then shows a second QR code / short URL, and phones rejoin with their rejoin code.

**Rejected:**
- **Vercel / Netlify:** serverless, so they can't hold open connections.
- **Supabase free Realtime:** 200 concurrent connections and **100 messages/second**. One "next question" broadcast to 400 phones is already 400 messages, and exceeding quotas can suspend the project.
- **Cloudflare quick tunnels / ngrok free:** a hard cap of 200 in-flight requests on quick tunnels, and no uptime guarantee.

Phase 7's load test runs on **both** deployments. If Render's 0.1 CPU can't handle 500 bots, it stays the standby only.

## 13. Open decisions

1. GitHub usernames of the leads, and whether the repo goes under a personal account or a club organisation.
1b. **Which hosting platform will the leads use?** It must not be serverless-only (§12.1).
2. Can the leads deploy by Sunday 11 am, and who is the deploy contact on Monday?
3. Event start time Monday, and rehearsal Sunday ~5 pm?
4. Club logo + colours.
5. Normal (~25 min) or short (~20 min) mode? **Recommended: short**, with extras skippable live.
6. 10 winners? (default)
7. Who is the host/presenter?
8. Is it OK to announce **"ties are broken by speed"**?
