# DATA SURVIVOR — Understanding & Execution Plan

**Event:** Orientation, Monday 12 October 2026
**Plan written:** Saturday 10 October 2026, evening (about 40 hours before the event)
**Expected audience:** up to 400 students on their own phones (we plan and test for **500**)
**Source proposal:** [PROPOSAL_v3.md](PROPOSAL_v3.md)

---

## 1. What we are building

Students in the hall scan a QR code and enter a nickname. They answer dilemma questions on their phones while the projector shows what the room chose.

**How the game works:**
- 4 rounds of 3 questions, each with 4 options (A–D). There are no right answers.
- After each round the server gives every player a **rarity score**: the less common your answers, the higher your score. The top N survive.
- Eliminated players go to **Analyst Mode**. They keep answering, and their answers still feed the charts, but they can't win.
- After each round the projector shows a **data moment** made from the real answers:
  1. **Spread:** how split the room was
  2. **Patterns:** which answers go together
  3. **Groups:** a map of the room, where each dot is a person
  4. **Prediction:** can a computer guess your answer, compared with a lazy guess
- **Finale:** 15–20 finalists answer 3 questions that have correct answers, plus a tie-breaker. The top 5–10 win chocolates.
- **Ending:** a "Room Decoded" recap on the projector, then each person gets a **Spotify Wrapped-style story** on their phone with a shareable card.

**Three screens, one website:**

| URL | Who uses it | Device |
|---|---|---|
| `/` (play) | Every student | Phone |
| `/screen` | The projector | Laptop on HDMI |
| `/host` | The presenter / tech team (password protected) | Second laptop or tablet |

---

## 2. The constraint that drives every decision

There are 2 days, not the 6 weeks the proposal assumed. This means:

1. **Simple architecture beats elegant architecture.** We need as few moving parts as possible, so there are fewer things to break.
2. **Testing is part of the build.** Load testing and a real rehearsal are fixed blocks of time in the schedule.
3. **Scope comes in tiers.** If time runs out we drop from the bottom tier, never from testing.

---

## 3. Architecture (and why it differs from the proposal)

The proposal suggested Next.js + Supabase. **I am changing this.** Here is the reasoning:

| Concern | Next.js + Supabase | **Chosen: one Node server + Socket.IO** |
|---|---|---|
| 400 live phones | Supabase's free tier caps realtime connections at about 200, so it would fail at our audience size | One Node process easily holds 1,000+ sockets |
| Moving parts | Frontend host + database + realtime + row-level security rules | **One server, one URL, one deploy** |
| Debugging on stage | Several dashboards | One log stream |
| Beginner-friendly | Security rules are easy to get subtly wrong | Phones only ever receive what the server chooses to send |

### The design

```
 Phones (400) ──┐
 Projector ─────┼── WebSocket (Socket.IO) ──►  ONE Node.js server
 Host laptop ───┘                              ├─ game state lives in memory (the single source of truth)
                                               ├─ scoring + analytics run here
                                               ├─ snapshot to disk every few seconds
                                               └─ serves the website (static files)
```

**Key principles:**

- **The server owns everything:** the timer, scores, who survived, and which scene is showing. Phones and the projector only display what the server sends.
- **"Render from snapshot":** every client, on connect or reconnect, gets the full current state for itself and draws it. A phone that locks, loses signal or refreshes comes back to the right screen. This one rule fixes most live-event bugs.
- **Answers are idempotent.** Each answer has an ID, and pressing twice stores it once. Answers that arrive after voting closes are rejected, and the phone says so politely.
- **Players keep a saved token.** A random ID is stored on the phone, so a refresh never creates a duplicate player.
- **Privacy is built into the data shape.** The projector gets only totals. A phone gets totals plus its own data. Raw answers never leave the server.
- **Small payloads.** The phone page should be under about 150 KB gzipped, and messages are tiny JSON, so it works on weak 4G.

### Stack

| Layer | Choice |
|---|---|
| Server | Node 22 + TypeScript + Express + Socket.IO |
| Frontend | Vite + React + TypeScript + Tailwind CSS |
| Animation | Framer Motion (projector); CSS transitions (phone, to keep it light) |
| Charts | Hand-written SVG with `d3-scale`/`d3-shape` helpers (full control, no generic look) |
| Analytics | Plain TypeScript in `server/analytics/`, using our own small PCA, k-means and k-nearest-neighbours (about 400×48 numbers, so it runs in milliseconds), with fixed random seeds |
| Tests | Vitest (logic) + a custom bot swarm script (load) |
| Hosting | **Render** (Starter plan, about $7, always on, supports WebSockets). Railway is the backup option. |

### Crash safety

- The server writes a state snapshot to disk every 5 seconds and reloads it on restart.
- The **host dashboard also keeps a copy** of the latest snapshot in the browser. If the server restarts with an empty disk, the host clicks **Restore** and the game continues from that point.
- A **manual override** lets the host type the survivor cutoff by hand.

---

## 4. Scope tiers

| Tier | What | Status if time runs out |
|---|---|---|
| **P0: the game works** | Join, nickname, 12 questions, server timer, host controls, projector bars, rarity scoring, survivors, Analyst Mode, finale + tie-breaker, winners, reconnect | Never cut |
| **P1: the "wow"** | Data Moment 1 (Spread) and 4 (Prediction), phone personal cards, Wrapped story (5 cards) + share image, Room Decoded recap | Cut only in an emergency |
| **P2: the extras** | Data Moment 2 (ribbons) and 3 (room map), "You are here" dot on the phone | Fallback: show a simple bar chart version |
| **P3: nice-to-have** | Margin of error, shuffle check badge, luck-check replay, "guess the popular option" tap, histogram with cutoff line | First to go |

I expect to deliver P0–P2, and P3 if testing goes well.

---

## 5. Game rules (filled-in details)

### Rarity score (per proposal §8)
- For each question, the share of an option is `p = (count + 1) / (total + 4)`. The "+1" smoothing stops tiny groups from producing extreme scores.
- The player's score for that question is `−log(p)`, and the round score is the average of the three questions.
- Shares use **all** players' answers (active + Analyst). **Only active players are ranked.**
- **Skipped question:** the player gets half of the room's average rarity on that question, so skipping never helps.
- **Ties at the cutoff:** everyone tied at the cutoff score survives. Survivor count may go slightly over target; nobody gets eliminated by a coin flip.

### Survivor targets (scaled for 400)
The host sees a **suggested** cutoff and can change it before locking:

| After | Keep | At 400 players | At 150 players |
|---|---|---|---|
| Round 1 | ~65% | ~260 | ~100 |
| Round 2 | ~60% | ~155 | ~60 |
| Round 3 | ~45% | ~70 | ~30 |
| Round 4 | fixed number | **20 finalists** | 15–20 |
| Finale | fixed number | **10 winners** (hard cap 20) | 5–10 |

### Finale ranking
Players are ranked by most correct answers, then by least total time on their correct answers, then by the tie-breaker question.

### Winner names on the projector
Winners are the **only** names ever shown on the projector. The host sees the list first and can hide an inappropriate nickname with one click before revealing it. Nicknames are also filtered for profanity and limited to 16 characters.

### Known weakness (from the proposal)
A player who always picks the option they think is least popular can game the rarity rule. Live counts are hidden until voting closes, which makes this hard. The simulation includes a "sneaky bot", and I'll report how far it gets.

---

## 6. Spotify Wrapped-style summary

A full-screen story on the phone. Tap to advance, with a progress bar at the top like Instagram stories:

1. **Intro:** "You answered 12 questions. Here's what the room learned about you."
2. **Your rarest choice:** "Only 7% of the room (28 people) chose this."
3. **You vs the room:** "You went against the most common answer on 7 of 12 questions."
4. **Your place on the map:** a small room map with your dot highlighted.
5. **Your thinking style:** a playful label (Evidence Hunter / Experimenter / Independent Builder / Systems Thinker / Strategic Planner, or "A bit of everything"), with the 3 answers that support it.
6. **Share card:** a 1080×1920 image (fits an Instagram story) with nickname (optional toggle), label, one real stat and club branding, saved with the phone's native Share button.

The labels come from simple tags on each option (each option is tagged as evidence, experiment, independent, systems or strategic). The tag mapping lives in one config file that the club leads should review. Every card says "Based on this room of n = X".

---

## 7. UI direction (avoiding "AI slop")

What makes a page look like generic AI output: purple-blue gradients everywhere, emoji in every heading, cards inside cards, a lot of small grey text, and no clear hierarchy.

What we'll do instead:

- **One strong identity:** a near-black background, **one** bright club accent colour, and white type. Data colours follow a fixed, colour-blind-safe set of 4 (one per option A–D) that stays the same on every screen. Option B on the phone is the same colour as B on the projector.
- **Type does the work:** big, bold, tight headings (a grotesque font such as *Space Grotesk* or *Inter Tight*). Numbers are huge ("18%"). There is one idea per screen.
- **Phone first:** answer buttons fill the screen width and are at least 64 px tall, reachable with a thumb. There is no scrolling during a question. The page works one-handed in a dark hall at 20% brightness.
- **Projector:** readable from the back row. Question text is at least 48 px, and charts are big and simple. Every chart shows **n = …**
- **Motion with purpose:** bars grow from zero, dots glide into the map, and Wrapped cards slide. Nothing bounces for decoration.
- **States that feel alive:** waiting screens show "Waiting for the host… 312 people in the room" instead of a spinner.

**What I need from you:** the club logo (SVG/PNG) and club colours. If we don't have them, I'll pick something tasteful and you can swap it later.

---

## 8. Testing plan (the most important section)

### 8.1 Automated logic tests (Vitest)
- Rarity maths on hand-checked examples, shares sum to 100%, scores are never negative, and the same seed gives the same result.
- Ties, skipped answers, a room of 1 person, and a room where everyone picks the same option.
- `simulateAudience(n, scenario, seed)` with the proposal's 7 scenarios. All 4 data moments must produce a valid result, or a valid "no pattern found" screen, in every scenario.
- An elimination simulation over many runs per scenario at n = 150 and n = 400 to check the finalist counts.

### 8.2 Load test (bot swarm)
A script launches **500 fake phones** against the **deployed** server (not localhost):
- All of them join within 60 seconds and answer within a 20-second window.
- 10% double-tap, 10% drop their connection mid-question and reconnect, and 5% answer late.
- The projector refreshes mid-round, and the host laptop refreshes mid-round.
- **Pass:** zero lost answers, zero duplicate answers, every bot's final state matches the server, and the server stays under 70% CPU.

### 8.3 Device check
- Real phones: Android Chrome (cheap and flagship), iPhone Safari, Samsung Internet, and the browser inside Instagram/WhatsApp (people will open the QR link there).
- Check small screens (360 px wide), dark mode, large system font, and a 3G-throttled connection.

### 8.4 Full rehearsal (required)
- **20–40 club members on their own phones**, the full game start to finish with a stopwatch, the real host, and the real projector laptop.
- Bot swarm running at the same time to push the room to about 400.
- Every rehearsal screen shows a **SIMULATED DATA** watermark, which is removed only when the host starts the real game (and the database is reset).

### 8.5 Go / No-Go (Sunday night)
1. 500-bot test passes on the deployed URL.
2. A rehearsal finishes in the planned time.
3. A projector or phone refresh returns to the correct screen.
4. No nicknames appear on the projector except approved winners.
5. Every data moment has a fallback image, switched with one key (F).

If any item fails, we drop the relevant P2/P3 features until it passes.

---

## 9. Schedule

| When | What | Who |
|---|---|---|
| **Sat night** | Repo, server, game engine, scoring + tests, phone join/answer screens, host controls, projector bars. **First deploy tonight** so hosting problems show up early. | Me (Claude) + you set up hosting |
| **Sun morning** | Data moments 1–4, analytics tests across all 7 scenarios, Analyst Mode, finale, winners | Me; you test on your phone as features land |
| **Sun midday** | Wrapped story + share image, recap, design polish, fallback images | Me; you collect logo/colours and the leads review the wording |
| **Sun ~3 pm** | **500-bot load test on the deployed URL**, fix issues | Me + you |
| **Sun ~5 pm** | **Rehearsal with club members** (real phones, real host) | Everyone |
| **Sun ~7 pm** | Fixes from the rehearsal, then **CODE FREEZE**. Go/No-Go check. | Me + you |
| **Sun night** | Print QR codes (large, plus a short backup URL), host script cheat-sheet, charge the laptops | You + host |
| **Mon, 2 h before** | Venue check: projector resolution, Wi-Fi vs mobile data, open `/screen` and `/host`, warm up the server, reset the database | You + host |

After code freeze, nothing changes except copy typos.

---

## 10. Event-day runbook (short version; the full one goes in `docs/RUNBOOK.md`)

**Network:** venue Wi-Fi often fails with 400 phones. The host's first line is *"Use mobile data if the Wi-Fi is slow."* The page is light enough that 4G is fine.

**Laptops:** the projector laptop shows only `/screen` (full screen, F11). The host uses a separate device for `/host`. Each laptop gets its own hotspot as a backup.

**If something breaks:**

| Problem | What to do |
|---|---|
| A few phones are stuck | "Refresh the page." Their saved token restores them. |
| Projector frozen | Refresh `/screen`. It returns to the current scene. |
| A data moment looks wrong | Press **F** to show the fallback image and say "here's what this looked like in rehearsal". |
| Server restarted | Host clicks **Restore**. |
| Total failure | Switch to the backup Google Form + printed slides version: a show of hands for the dilemmas and the finale on paper. This keeps the event going. |

---

## 11. Privacy (from the proposal, enforced in code)

- Nickname only: no email, phone number or student ID.
- The join screen says: *"Your answers are anonymous and only used for live group charts. Data is deleted after the event."*
- Groups or tables with fewer than 5 people are hidden.
- Raw answers are deleted after the event (a one-click export is available beforehand if the leads want anonymous totals).

---

## 12. Repository & access

- Repo: `data-survivor`, **private** on GitHub, owned by you (or a club organisation account, if one exists).
- Club leads are added as collaborators. **I need their GitHub usernames.**
- Structure:

```
data-survivor/
  server/       game engine, socket handlers, analytics, scoring
  web/          React app: play, screen, host
  shared/       question bank, types, tag mapping (leads review this)
  scripts/      bot swarm load test, audience simulator
  docs/         proposal, this plan, runbook, host script
```

The GitHub CLI isn't installed on this laptop yet. You'll either install it (`winget install GitHub.cli`, then `gh auth login`) or create the repo on github.com and I'll push to it.

---

## 13. How you'll learn while we build

You said you haven't built a live site before. Here is how you'll learn along the way:

- Each chunk I build comes with a short "what this does and why" note in plain words.
- You'll run things yourself: start the server, open three tabs (phone, screen, host) and play a game alone.
- You'll own **hosting, the rehearsal and the event-day runbook**. These are the parts where a human in the room matters most.
- After the event, the repo is a good portfolio project. The realtime + analytics design is something you'll be able to explain in interviews.

---

## 14. Open decisions (need answers soon)

1. **GitHub usernames** of the club leads, and personal account or club org?
2. **Hosting budget:** about $7 for one month of Render Starter. Can the club cover it? The free tier sleeps and is not safe for a live event.
3. **Event time on Monday**, and can we do a rehearsal Sunday ~5 pm?
4. **Club logo + colours**.
5. **Normal (~25 min) or short (~20 min) mode?** I recommend short mode with extras skippable live.
6. **Winners:** 10 is the default. Confirm.
7. **Who is the host/presenter?** They need to try the host controls at the rehearsal.
