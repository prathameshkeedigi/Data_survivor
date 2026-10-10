# DATA SURVIVOR

**A live, phone-based data game for the Data Science Club orientation (Monday 12 October 2026).**

Up to 500 students scan a QR code and answer dilemma questions on their phones. Rare answers survive, and the projector turns the room's answers into live data stories. At the end, every student gets a personal, Spotify Wrapped-style summary they can share.

This README is the **single source of truth** for the project: what it is, how it works, how it was built and tested, how to run it on your laptop, how to deploy it, and how to run the event. The files in [`docs/`](docs/) keep the full working detail behind each section.

---

## Contents

1. [At a glance](#1-at-a-glance)
2. [How the game works](#2-how-the-game-works)
3. [Game rules](#3-game-rules)
4. [Data moments (the analytics)](#4-data-moments-the-analytics)
5. [Wrapped (personal summary)](#5-wrapped-personal-summary)
6. [Architecture](#6-architecture)
7. [Tech stack](#7-tech-stack)
8. [Project structure](#8-project-structure)
9. [Run it on your laptop](#9-run-it-on-your-laptop)
10. [Configuration](#10-configuration)
11. [Testing](#11-testing)
12. [Implementation workflow and phases](#12-implementation-workflow-and-phases)
13. [Deployment](#13-deployment)
14. [Event-day runbook](#14-event-day-runbook)
15. [Security and privacy](#15-security-and-privacy)
16. [Design system](#16-design-system)
17. [Known limitations](#17-known-limitations)
18. [Further documentation](#18-further-documentation)

---

## 1. At a glance

| | |
|---|---|
| **Audience** | About 400 students on their own phones (tested with 500) |
| **Length** | About 35–45 minutes |
| **Format** | 4 rounds × 3 questions, then a 4-question finale, then the winners, the recap and Wrapped |
| **Devices** | Phones (players), a projector laptop, and a host laptop plus a backup phone |
| **Infrastructure** | One Node.js server, one URL, no database. The game state lives in memory. |
| **Status** | Phases 1–7 and 9 are complete and tested. Phase 8 (deploy and rehearsal) needs people. See [§12](#12-implementation-workflow-and-phases). |

**The three pages**

| URL | Who uses it | Device |
|---|---|---|
| `/` | Every student | Phone |
| `/screen` | The projector. `/screen?preview=1` to `4` shows each chart with simulated data. | Laptop on HDMI |
| `/host` | The presenter and tech team (password protected) | Laptop or tablet, plus a backup phone |
| `/health` | A health check: `{"ok":true, players, sockets, scene, lagMs, rssMb}` | Anyone |

---

## 2. How the game works

```
Lobby (scan QR, pick a nickname, get a 4-character rejoin code)
  │
  ├─ Round 1 ─ Q1 → Q2 → Q3 → Results → Survivors → Data moment 1: Spread
  ├─ Round 2 ─ Q4 → Q5 → Q6 → Results → Survivors → Data moment 2: Patterns
  ├─ Round 3 ─ Q7 → Q8 → Q9 → Results → Survivors → Data moment 3: Groups
  ├─ Round 4 ─ Q10 → Q11 → Q12 → Results → Finalists → Data moment 4: Prediction
  │
  ├─ Finale intro → F1 → F2 → F3 → Tie-breaker → Finale results
  │
  └─ Winners (podium) → Recap ("The room, decoded") → Wrapped on every phone
```

- **The questions** are dilemmas with 4 options and no right answer. The less common your answers, the higher your **rarity score**.
- **After each round** the top players survive. Everyone else moves to **Analyst Mode**: they keep answering and their answers still feed the charts, but they can no longer win.
- **The finale** has about 20 finalists and objective questions with right answers. Correct *and fast* wins. There are 10 winners, with a hard cap of 20.
- **The host** moves through the scenes. Question timers run on the server.

What each screen shows:

| Scene | Projector | Phone |
|---|---|---|
| Lobby | QR code, join steps, one dot per person who has joined | Nickname entry, then your rejoin code |
| Question | Question, A–D option cards, countdown timer, "% answered" ring | Four large answer buttons, then "Locked in: B" |
| Results | Answer bars per question | Your answers, "% of the room chose the same", and the room's split as mini bars |
| Survivors | Survivor count, plus a histogram of everyone's rarity score with the survival line | "You survived" or "You're an Analyst now" |
| Data moment | One of four live analytics charts (see [§4](#4-data-moments-the-analytics)) | A personal card ("You're one of 37 people who…") |
| Winners | Podium for the top 3, plus the list of the other winners | "WINNER" and a code to show at the stage |
| Recap | Four chart thumbnails summing up the session | — |
| Wrapped | — | Your personal story cards and a share image |

---

## 3. Game rules

### Rarity score

- The share of an option is `p = (count + 1) / (total + 4)`. The +1 smoothing stops a tiny group from getting an extreme score.
- The score for one question is `−ln(p)`. The round score is the mean over the round's 3 questions.
- Shares are computed from **all** players' answers, but **only active players are ranked**.
- **A skipped question** scores half the room's average, so skipping never pays.

### Ranking and ties

Players are ordered by:
1. Round score.
2. Faster total answer time in that round, measured by the server.
3. Player ID, as a deterministic last resort.

The host screen shows the suggested cutoff and how many players are tied at it, and the host can adjust the cutoff before locking survivors.

### Joining late

- Players join as **active** until round 1 voting closes.
- After that, they join in **Analyst Mode**.

### Survivor targets (suggested; the host can change them)

| After | Keep | At 400 players | At 150 players |
|---|---|---|---|
| Round 1 | about 65% | about 260 | about 100 |
| Round 2 | about 60% | about 155 | about 60 |
| Round 3 | about 45% | about 70 | about 30 |
| Round 4 | fixed | **20 finalists** | 15–20 |
| Finale | fixed | **10 winners** (cap 20) | 5–10 |

### Finale ranking

There are 3 scored questions plus a tie-breaker that is **always asked**, so there is no branching on stage. Winners are ordered by:
1. Most correct answers.
2. Least total time on correct answers.
3. Whether the tie-breaker answer was correct.
4. Tie-breaker time.
5. Player ID.

The answer keys exist only on the server and are never sent to browsers before the reveal.

---

## 4. Data moments (the analytics)

After each round, the projector shows a chart computed from the room's real answers the moment voting closes. Analytics are plain TypeScript with fixed random seeds, so the same data always gives the same result. All four together take well under a second for 500 players.

| # | Moment | Question it answers | Method | Minimum players |
|---|---|---|---|---|
| 1 | **Spread** | How split was the room? | Share per option, with a split label (near-even / leaning / strong favourite) and a ±95% margin of error | 20 |
| 2 | **Patterns** | Which answers go together? | Lift (`P(B given A) / P(B)`) over all question pairs, plus a 100-shuffle permutation check that it isn't chance. Groups smaller than 5 are never shown. | 40 |
| 3 | **Groups** | What does the room look like as a map? | One-hot encoding, then PCA to 2-D, then k-means (k = 2–3) chosen by silhouette score. One dot per person. | 40 |
| 4 | **Prediction** | Can a computer guess your answer? | Leave-one-out k-nearest-neighbours (k = 5) vs a "lazy" guess of the most popular answer, with a 200-shuffle permutation test | 60 |

Below the minimum size, a plain message replaces the chart. If a calculation ever fails, the host presses **F** to show a pre-made fallback chart.

---

## 5. Wrapped (personal summary)

At the end, each phone shows a story you tap through. Every card is based on the real room ("n = X people").

| Card | Content | Visual |
|---|---|---|
| Intro | Your nickname, questions answered, status (winner, finalist, survivor or analyst) | — |
| Your rarest choice | "Only 7% (28 people) chose what you did on Q5" | Bar chart of the room's split, with your option highlighted |
| You vs the room | How many times you went against the most popular answer | 12-question timeline: with the crowd, against it, or skipped |
| Round by round | How common your answers were in each round vs the room average | Paired bar chart |
| Your place on the map | Your dot on the room map from data moment 3 | Scatter map |
| Your thinking style | A playful label (for example "Strategic Planner") and the 3 answers behind it | Tag bar chart |
| Share | A 1080×1920 image drawn with Canvas. Uses the phone's Share button, or "long-press to save" as a fallback. The nickname is optional. | Image preview |

---

## 6. Architecture

```
 Phones (up to 500) ─┐
 Projector ──────────┼── Socket.IO (WebSocket, falls back to HTTP polling) ──► ONE Node.js process
 Host ×2 ────────────┘                                                         ├─ game state in memory
                                                                               ├─ scoring + analytics
                                                                               └─ serves the web pages
```

**Core rules (these are what keep it reliable)**

1. **The server owns all truth.** The scene, timer, scores and survivors live on the server. Browsers only display them.
2. **Draw from a snapshot.** On every connect or reconnect, a client receives the full view it is allowed to see. Refreshing any screen is always safe.
3. **Answers are idempotent.** There is one answer per player per question, and the first tap wins. A second tap returns the stored answer. An answer only counts if the question is open and the option is valid.
4. **The timer is sent as time remaining.** The server sends `msRemaining`, and phones count down locally from it. Voting closes only when the server's timer fires.
5. **Updates are throttled.** During voting, only the host and projector receive the answered count, at most twice per second. Phones only get their own confirmation.
6. **Each role gets its own view.** Messages go to rooms (`all`, `screen`, `host`, `player:<id>`). Raw answers and other players' IDs never leave the server.
7. **Identity has a fallback.** A token is stored on the phone, and a 4-character rejoin code is shown in case the token is lost.
8. **One process means no races.** Node handles one message at a time, so two answers can never be processed at the same moment.
9. **Crash safety.** The host browser saves a full backup every 5 seconds. After a server restart, **Restore** pushes it back, and phones reconnect automatically.

---

## 7. Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 (works on 20 or newer) |
| Language | TypeScript, end to end |
| Server | Express 5 + Socket.IO 4.8 |
| Validation | `zod` on every incoming message |
| Frontend | React 19 + Vite 8 (one bundle per page) + Tailwind CSS 4 |
| Charts | Hand-written SVG (bars, ribbons, histogram), plus Canvas for the 500-dot map, the join dots and the share image |
| Font | Space Grotesk (bundled locally, no CDN) |
| QR code | `uqr` |
| Analytics | Plain TypeScript: PCA, k-means, k-NN and permutation tests, all written in this repo |
| Unit and integration tests | Vitest, with real Socket.IO clients for the integration tests |
| End-to-end tests | Playwright (real Chromium) |
| Load test | A custom bot swarm (`scripts/swarm.ts`) |
| Packaging | Dockerfile (Node 22 Alpine), or plain `npm start` |

**Deliberately not used:**
- **A database.** One event, one server: state in memory plus the host backup is simpler and faster.
- **Serverless hosting** (Vercel, Netlify). It can't hold 400 live connections.
- **Supabase Realtime.** The free tier caps out at 200 connections and 100 messages per second.

---

## 8. Project structure

```
data-survivor/
├── server/
│   ├── index.ts            entry point: reads config, starts the server
│   ├── config.ts           environment variables (HOST_PASSWORD, PORT, timings)
│   ├── app.ts              Express: /health and the static pages
│   ├── server.ts           Socket.IO handlers, rate limits, rooms, timers
│   ├── views.ts            per-role views (player / screen / host)
│   ├── engine/
│   │   ├── game.ts         the game state machine (scenes, answers, locks, finale)
│   │   └── scoring.ts      rarity score, ranking and tie-breaks
│   ├── analytics/
│   │   ├── moments.ts      Spread, Patterns, Groups, Prediction
│   │   └── wrapped.ts      each player's Wrapped data
│   ├── finaleKeys.ts       finale answer keys (server only)
│   ├── nickname.ts         nickname cleaning and profanity filter
│   └── sim/                simulated audiences for tests and rehearsal
├── shared/
│   ├── questions.ts        the question bank and option tags
│   ├── types.ts            scene and game types
│   ├── views.ts            what each browser is allowed to see
│   └── moments.ts          data moment and Wrapped payloads
├── web/
│   ├── index.html, screen.html, host.html
│   └── src/
│       ├── play.tsx        phone app
│       ├── play/Wrapped.tsx  Wrapped story and share image
│       ├── screen.tsx      projector
│       ├── host.tsx        host controls
│       ├── components/     charts.tsx (moment charts), visuals.tsx (projector and Wrapped visuals)
│       ├── lib/live.ts     socket connection, countdown, shared constants
│       └── styles.css      design tokens and animations
├── tests/                  Vitest: phase1 … phase9 (test IDs in test names)
├── tests-e2e/              Playwright: full game in real browsers
├── scripts/
│   ├── swarm.ts            load test with 500 bots
│   ├── capture-screen.mjs  screenshots of every projector scene
│   ├── check-bundle.mjs    phone bundle size budget (150 KB gzipped)
│   └── make-fallbacks.ts   generates the fallback charts
├── docs/                   detailed plan, phases, deploy and runbook
└── Dockerfile
```

---

## 9. Run it on your laptop

### Prerequisites

- **Node.js 22**: from [nodejs.org](https://nodejs.org) (LTS). Check with `node -v`.
- **Git**: from [git-scm.com](https://git-scm.com).

### Step 1: get the code (first time only)

```bash
git clone https://github.com/prathameshkeedigi/Data_survivor.git
cd Data_survivor
npm ci
```

### Step 2: build and start

`npm run build` is only needed after a code change. Use a password of at least 8 characters.

**Windows (Command Prompt / cmd)**
```bat
npm run build
set HOST_PASSWORD=pick-a-password
npm start
```

**Windows (PowerShell)**
```powershell
npm run build
$env:HOST_PASSWORD="pick-a-password"
npm start
```

**macOS / Linux**
```bash
npm run build
HOST_PASSWORD=pick-a-password npm start
```

Keep this terminal open. Closing it stops the game. Press **Ctrl + C** to stop it.

### Step 3: open the pages

| Page | Address |
|---|---|
| Projector | http://localhost:3000/screen (press F11 for full screen) |
| Host | http://localhost:3000/host (log in with your password) |
| Player | http://localhost:3000 |

### Step 4 (optional): join from real phones on the same Wi-Fi

1. **Find your laptop's IP address.**
   - On Windows, run `ipconfig` and use the **IPv4 Address** under **Wireless LAN adapter Wi-Fi**. Ignore virtual adapters such as `192.168.56.x`.
   - On macOS, run `ipconfig getifaddr en0`.
2. **Open the projector page using that IP**, for example `http://10.244.94.180:3000/screen`. The QR code uses whatever address the page was opened with.
3. **Phones** scan the QR code, or open `http://<your-ip>:3000`. Type `http://` yourself.
4. **If phones show "This site can't be reached":**
   - Windows Firewall is blocking port 3000. Open **Command Prompt as administrator** and run:
     ```bat
     netsh advfirewall firewall add rule name="Data Survivor 3000" dir=in action=allow protocol=TCP localport=3000
     ```
     Remove it afterwards with `netsh advfirewall firewall delete rule name="Data Survivor 3000"`.
   - Campus Wi-Fi often blocks devices from talking to each other. Use a phone hotspot instead, connect the laptop to it, and run `ipconfig` again.

### Step 5 (optional): fill the room with fake players

In a second terminal (same folder):
```bash
npx tsx scripts/swarm.ts --url http://localhost:3000 --n 300 --passive
```
`--passive` makes the bots only join and answer, so you still drive the game from `/host`.

### Development mode (live reload)

```bash
npm run dev       # server with auto-restart (needs HOST_PASSWORD set)
npm run dev:web   # Vite dev server for the pages
```

---

## 10. Configuration

All settings are environment variables. **Never put the password in code or commit it.**

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `HOST_PASSWORD` | **Yes** | — | Password for `/host`. At least 8 characters. The server refuses to start without it. |
| `PORT` | No | `3000` | Port to listen on. Most hosts set it automatically. |
| `QUESTION_MS` | No | `20000` | Time per dilemma question, in milliseconds (1000–600000) |
| `FINALE_MS` | No | `25000` | Time per finale question, in milliseconds |
| `WEB_DIR` | No | `dist/web` | Folder with the built pages |

---

## 11. Testing

The project was built **test-first**: every feature's test cases were written down (with IDs such as `E6`, `R5`, `A4`) and committed failing, before the code that makes them pass. Test names contain their IDs, so test output maps one to one onto [`docs/BUILD_PHASES.md`](docs/BUILD_PHASES.md).

### Commands

| Command | What it runs | Time |
|---|---|---|
| `npm run typecheck` | TypeScript type check | ~10 s |
| `npm test` | All unit and integration tests (78), including 2,000 simulated games | ~45 s |
| `npm run test:fast` | The same, without the long simulation | ~15 s |
| `npm run build && npm run verify` | Production build, plus a check that the phone page stays under 150 KB gzipped | ~10 s |
| `npm run test:e2e` | Playwright: a host, two projectors (16:9 and 4:3) and three phones play a full game in real Chromium. Screenshots go to `test-results/screens/`. | ~1.5 min |
| `npx tsx scripts/swarm.ts --url <url> --password <pw> --n 500 --reset` | Load test: 500 bots plus 50 malicious connections play a whole game | ~4 min |

First time only, before the end-to-end tests: `npx playwright install chromium`.

> ⚠️ `--reset` wipes the running game. **Never** use it once real students have joined. Load-test with the default 20-second question timer: with very short timers, bots that reconnect near the deadline are wrongly counted as on-time rejections.

### Test types

| Type | Tool | Covers |
|---|---|---|
| Unit | Vitest | Scoring, ranking, analytics, config, Wrapped data |
| Integration | Vitest + real Socket.IO clients | Joining, reconnecting, answers, host actions, backup/restore, polling-only clients |
| Simulation | Vitest | 2,000 complete games with realistic simulated audiences |
| End-to-end | Playwright | Full game across every page, refresh and offline recovery, every chart visible |
| Load | Bot swarm | 500 phones, double taps, reconnects, late answers, attacks |
| Manual | Checklists | Real iPhone/Android, in-app browsers (Instagram, WhatsApp), venue Wi-Fi, projector |

### Latest results (11 October 2026)

| Check | Result |
|---|---|
| Unit and integration | **78 / 78 pass** |
| End-to-end | **2 / 2 pass** |
| Phone bundle | **99.7 KB** gzipped (budget 150 KB) |
| Load: 500 bots joined | 500 / 500 in 45 s, 0 errors |
| Load: answers | **0 lost**, 0 changed out of 7,371. All 421 late answers rejected. 0 on-time answers rejected. |
| Load: speed | Scene change reaches phones in p50 48 ms, p95 251 ms |
| Load: server | Event-loop lag 25 ms, memory 123 MB |
| Load: abuse | 50 malicious connections: 0 bad requests accepted |

---

## 12. Implementation workflow and phases

### Workflow (test-driven development)

1. **Spec**: write the test cases in `docs/BUILD_PHASES.md`, each with an input and expected result.
2. **Red**: write the tests as code, see them **fail**, and commit (`test(phaseN): …`).
3. **Green**: write the smallest code that passes, and commit (`feat(phaseN): …`).
4. **Refactor**: clean up while the tests stay green.
5. **Gate**: a phase is done only when all its tests pass and it has been tried by hand.

Any bug found later gets a reproducing test first, then the fix.

### Phases

| Phase | Builds | Tests | Status |
|---|---|---|---|
| 1. Foundation | Project setup, config, health check, question bank, secrets check | F1–F5 | ✅ Done |
| 2. Game engine | Scenes, answers, rarity scoring, ranking, ties, finale (pure logic) | E1–E32 | ✅ Done. 2,000 simulated games; 5 deliberately injected bugs all caught. |
| 3. Realtime | Socket.IO server, rooms, rate limits, reconnects, backup/restore | R1–R17 | ✅ Done |
| 4. Screens | Phone, projector (16:9 and 4:3) and host pages | U1–U8 | ✅ Done (automated). U8 needs real devices. |
| 5. Data moments | Spread, Patterns, Groups, Prediction, fallbacks | A1–A11 | ✅ Done |
| 6. Wrapped and recap | Personal story cards and share image | W1–W7 | ✅ Done (automated). W4–W5 need real phones. |
| 7. Hardening and load | 500-bot swarm, malicious clients, reconnects | L1–L9 | ✅ Passed locally |
| 9. Visual upgrade | Projector charts (join dots, answer ring, survivors histogram, podium, recap thumbnails), phone result bars, Wrapped charts, new type and palette | V1–V11 | ✅ Done |
| 8. Deploy and rehearsal | Deploy, load test on the real URL, real devices, rehearsal, final reset | D1–D7 | ⏳ Needs people (see [§13](#13-deployment) and [§14](#14-event-day-runbook)) |

**Still manual:**
- Real iPhone and Android phones, including in-app browsers.
- The share sheet on real phones.
- The load test against the real host.
- Campus Wi-Fi and the projector laptop.
- The rehearsal.

---

## 13. Deployment

Phones on mobile data or other networks can only reach the game once it is deployed to a public **HTTPS** URL.

### Requirements for any host

| Must have | Why |
|---|---|
| A long-running process (Docker or Node 22) | Serverless platforms can't hold live connections |
| WebSockets allowed | Live updates (HTTP polling works as a fallback) |
| **Exactly 1 instance**, autoscaling off | The game lives in one server's memory |
| HTTPS | Phone sharing, and trust when people scan the QR code |
| `HOST_PASSWORD` set in the dashboard | Protects `/host` |

### Option A: AWS EC2 (preferred if credits are available)

1. Launch an instance:
   - Region **Mumbai (ap-south-1)**, **Ubuntu 24.04**, type **t3.small**.
   - Security group: allow ports 80 and 443 from anywhere, and 22 from your IP only.
2. Install and run the app:
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io git caddy
   git clone https://github.com/prathameshkeedigi/Data_survivor.git && cd Data_survivor
   sudo docker build -t data-survivor .
   sudo docker run -d --name ds --restart unless-stopped -p 127.0.0.1:3000:3000 \
     -e HOST_PASSWORD='CHANGE-ME-long-password' data-survivor
   ```
3. Set up HTTPS with Caddy, which gets the certificate automatically. Use your domain, or `<ip-with-dashes>.sslip.io` if you have none:
   ```bash
   echo 'play.yourclub.in {
     reverse_proxy 127.0.0.1:3000
   }' | sudo tee /etc/caddy/Caddyfile
   sudo systemctl restart caddy
   ```

### Option B: Railway (quickest; about 10 minutes)

1. Go to [railway.com](https://railway.com) and sign in with GitHub. Choose **New Project**, then **Deploy from GitHub repo**, then **Data_survivor**. The Dockerfile is found automatically.
2. Open the service:
   - **Variables:** add `HOST_PASSWORD`.
   - **Settings:**
     - Region **Southeast Asia (Singapore)**.
     - Replicas **1**.
     - Health check path `/health`.
     - Networking: **Generate Domain**.
3. Wait for **Active**, then open `https://<domain>/health`.

### Option C: Render (standby)

1. Choose **New**, then **Web Service**, and connect the repo.
2. Configure it:
   - Runtime **Docker**.
   - Region **Singapore**.
   - Health check path `/health`.
   - Add `HOST_PASSWORD`.
3. On the free plan the server sleeps after 15 minutes idle, so keep `/screen` open from 15 minutes before the event.

### After deploying

1. `https://<url>/health` should return `{"ok":true,...}`.
2. Run the load test against the real URL. Every line should say PASS.
   ```bash
   npx tsx scripts/swarm.ts --url https://<url> --password <pw> --n 500 --reset
   ```
3. Join from real phones on **mobile data** and on **campus Wi-Fi**, at least one iPhone and one Android.
4. Check the charts on the real projector with `https://<url>/screen?preview=1` to `4`.

**Update after a code change (never after Monday's final reset):**
- **AWS:** `git pull`, rebuild the image, then replace the container.
- **Railway / Render:** push to `main` and it redeploys automatically.

---

## 14. Event-day runbook

### Devices

| Device | Open | Notes |
|---|---|---|
| Projector laptop | `https://<url>/screen` | Full screen (F11), zoom 100%, Do Not Disturb on, sleep off, charger in |
| Host device | `https://<url>/host` | Log in with the password |
| Backup host (a phone) | `https://<url>/host` | Logged in too, in case the main host device dies |

**Host keys:**
- **Space**: next
- **←**: back
- **P**: pause or resume the timer
- **F**: fallback chart

Confirm dialogs protect **Lock survivors**, **Lock winners**, **Reset** and **Restore**.

### Two hours before

- [ ] `/health` shows `"ok": true`.
- [ ] `/screen` is in full screen and readable from the back row.
- [ ] Two phones join: one on campus Wi-Fi, one on mobile data.
- [ ] **Final reset:** on `/host`, choose **Reset game…** and type `RESET`.
- [ ] Turn off the rehearsal badge.
- [ ] **No code changes or redeploys from this point.**

### Running the show

| Scene | Host says / does |
|---|---|
| Lobby | "Scan the QR code. If the Wi-Fi is slow, switch to mobile data." Wait until the count stops rising. |
| Question | The server runs the timer. Press **Space** to close voting early once almost everyone has answered. |
| Results | Read one surprising bar, then **Lock survivors** and press Next. |
| Survivors | "Rarer answers survived. Everyone else is now an Analyst: keep answering, the charts need you." |
| Data moment | Explain the chart. If it looks wrong, press **F**. |
| Finale intro | "Rarity got you here. Knowing data wins it. Correct **and fast** wins." |
| Finale results | Check the winners list, hide any offensive nickname, then **Lock winners** and press Next. |
| Winners | "Winners: show your phone at the stage." |
| Recap → Wrapped | "Check your phone: swipe through your Wrapped and share it." |

### If something breaks

| Problem | Do this |
|---|---|
| A few phones are stuck | "Refresh the page." If they're logged out, they use **Rejoin with your code**. |
| Projector frozen | Refresh `/screen`. It returns to the current scene. |
| A chart looks wrong | Press **F** for the fallback chart. |
| Host laptop dies | Use the backup host phone. |
| Server restarted (game back at the lobby) | On `/host`, click **Restore** (the backup is at most 5 seconds old). |
| Server completely down | Open the standby URL's `/host` and upload the downloaded backup. Show the standby QR code. Phones rejoin with their code. |
| Everything down | Switch to the paper or Google Form version of the questions. |

Tip: click **Download** on `/host` after each round to keep a backup file.

---

## 15. Security and privacy

| Threat | Protection |
|---|---|
| Someone opens `/host` | Password from the environment (never in code); signed host session |
| Fake-join floods | Cap of 800 players, **Lock joining** button, per-connection rate limits. There is no per-IP cap, because a whole hall shares one Wi-Fi IP. |
| Spam or malformed messages | `zod` validation, rate limits, invalid messages dropped |
| Double-pressing Next | Scene changes are limited to one per 600 ms |
| Reading finale answers from the browser | Answer keys never leave the server before the reveal |
| Offensive nicknames | 16-character limit, profanity filter. Nicknames only reach the projector for winners, after host approval. |
| Script injection | React escapes all text; no raw HTML |

**Privacy:**
- Charts show only aggregates, with no IDs or nicknames.
- Groups smaller than 5 are never reported.
- Each phone receives only its own data and its own dot on the map.
- Nothing is stored on disk. When the server stops, the data is gone.

---

## 16. Design system

| Token | Value | Use |
|---|---|---|
| Background | `#0b0a0f` | Near-black, readable in a dark hall |
| Surfaces | `#15131c`, `#1e1b28`, line `#2b2737` | Cards and panels |
| Brand | `#7b5ac6` (ink `#c3b1ff`) | Club purple: survivors, highlights |
| Option A / B / C / D | `#3987e5` / `#d95926` / `#199e70` / `#c98500` | Fixed on every screen. Checked to be colour-blind-safe on the dark background. |
| Typeface | Space Grotesk (variable, bundled) | Every page |

- **Layout:** the projector works at 16:9 and 4:3. The phone works from 360 px wide.
- **Motion:** only `transform` and `opacity` animate, so it stays smooth on weak laptops. Animations respect reduced-motion settings.
- **Groups:** the room map shows at most 3 groups, because only 3 colours stay colour-blind-safe as small dots.

---

## 17. Known limitations

- **One server, memory only.** A crash loses up to 5 seconds of state, which the host's **Restore** recovers. Don't redeploy during the event.
- **Gaming the rarity rule.** In 1,000 simulated games, a bot that *knows* the least popular option reaches the finale 99.9% of the time, and a random tapper 60.6% of the time. An average real player reaches it 13.2% of the time. This is inherent to a minority game. Winners are decided by the objective finale questions, which can't be gamed this way.
- **Local network testing.** Campus Wi-Fi may block phone-to-laptop connections. Use a hotspot, or the deployed URL.

---

## 18. Further documentation

| Document | Contents |
|---|---|
| [docs/EXECUTION_PLAN.md](docs/EXECUTION_PLAN.md) | The full reviewed plan: decisions, risks, schedule, go/no-go checklist |
| [docs/BUILD_PHASES.md](docs/BUILD_PHASES.md) | Every test case by ID (F, E, R, U, A, W, L, D, V) |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deployment details for each host |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Printable event-day checklist |
| [docs/PROPOSAL_v3.md](docs/PROPOSAL_v3.md) | The original game proposal and question bank |

---

*Built for the Data Science Club orientation, October 2026.*
