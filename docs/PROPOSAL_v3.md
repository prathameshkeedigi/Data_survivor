# DATA SURVIVOR: Your Generation, Decoded
## Data Science Club Orientation Activity — Project Proposal & Build Plan (v3, simplified)

**Audience:** 1st- and 2nd-year college students  
**Expected participants:** 100–200  
**Format:** Seated, mobile-first interactive game with live projector visuals  
**Duration:** About 22–25 minutes (about 20 in "short mode")  
**Prizes:** Target 5–10 chocolate winners; never more than 20  
**Platform:** Custom website (player, host, projector)  
**Tagline:** *Three questions. One combined profile. Your generation, decoded.*

---

## 0. What Changed in v3

v2 was too technical. v3 keeps the same idea (a short "data moment" on the projector after every round) but:

- Uses **plain words on screen**. No entropy, PCA, clustering, cross-validation, bootstrap or permutation tests. Those stay in the code, not on the slides.
- Teaches **only four simple ideas**, one per round.
- Cuts the extra visuals. Each round has **one main visual and one sentence of explanation**.
- Shortens the tech plan to what the team actually needs to build.

### The four ideas the audience will learn

| After | Plain-language idea | The question the projector asks |
|---|---|---|
| Round 1 | **Spread** | "How split was the room?" |
| Round 2 | **Patterns** | "Which answers tend to go together?" |
| Round 3 | **Groups** | "Who answered like you?" |
| Round 4 | **Prediction** | "Can a computer guess your answer?" |

> **Design rule:** every data moment should be explainable in one sentence a first-year student already understands, and it should end with "this is how real companies use it".

---

## 1. Executive Summary

**DATA SURVIVOR** is an interactive game for the Data Science Club orientation. Students join with a QR code, answer dilemma questions on their phones, and watch live results on the projector.

The game mechanic is **minority-choice survival**: students whose answers are less common than the room's survive to the next round. Winners of a final reasoning challenge get chocolates.

After each round, the projector shows what their answers can become: how split the room is, which answers go together, who sits near whom, and whether a computer can guess them. Everyone, including eliminated players, gets a Spotify Wrapped-style personal summary at the end.

The goal is the moment a student thinks: *"That dot is me, and my one tap helped build this."*

> **Important framing:** The game rewards answer rarity, not intelligence. A minority answer is not better or more correct. Summaries and groups are playful descriptions of answers, not psychology tests.

---

## 2. Goals

- Get the whole audience participating from their seats.
- Show, with their own answers, what data science looks like in practice.
- Teach four simple ideas: spread, patterns, groups, prediction.
- Give each person a personal, shareable summary.
- Award chocolates to a controlled number of winners.

---

## 3. Participant Experience

1. Scan the QR code and enter a nickname. No app install.
2. Answer each question privately within the time limit.
3. Voting closes, then the projector shows how the room answered.
4. Rarity scores decide who advances.
5. **A short "data moment" plays on the projector; each phone shows a personal card.**
6. Eliminated players enter **Analyst Mode**: they keep answering and keep getting data moments, but cannot win chocolates.
7. Finalists play an objective data-reasoning showdown.
8. Winners are announced.
9. A closing "Room Decoded" recap, then everyone gets their personal summary.

Analyst Mode matters because it keeps everyone involved and keeps the data set large enough for the later data moments.

---

## 4. Game Structure

| Stage | Theme | Questions | Illustrative target | Data moment |
|---|---|---:|---:|---|
| Round 1 | Identity & Ambition | 3 | 150 → about 100 | **Spread** |
| Round 2 | AI & Intelligence | 3 | 100 → about 60 | **Patterns** |
| Round 3 | Social Psychology | 3 | 60 → about 30 | **Groups** |
| Round 4 | Risk & Uncertainty | 3 | 30 → about 15–20 | **Prediction** |
| Finale | Data Showdown | 3 | 15–20 → 5–10 winners | Recap |

Survivor counts are targets. The host can change cutoffs live. If fewer people join, scale the cutoffs. Never award more than 20 prizes; recommended is **10**.

### Timing

| Segment | Normal | Short mode |
|---|---:|---:|
| Welcome and joining | 2 min | 2 min |
| Each round: answer + results + data moment (×4) | ~3.5 min each | ~3 min each |
| Finale | 3 min | 3 min |
| Winners + recap | 3 min | 2 min |
| **Total** | **~22–25 min** | **~20 min** |

The original brief was 15–20 minutes. The data moments add about 4 minutes. Decide whether to run normal or short mode, and rehearse both. The host can skip the optional extras with one key press.

---

## 5. The Data Moments (after each round)

All four use the same simple format, about 45–60 seconds:

1. **Question on screen** (5 s): e.g. "How split was this room?"
2. **Main visual** (25–30 s): one animated chart from the real answers.
3. **One-line idea** (10 s): the plain-language concept.
4. **Real-world line** (10 s): where companies use it.
5. **Optional extra** (15–20 s): host can skip.

Every chart shows how many people it is based on (**n = 143**). Phones show a personal card at the same time.

---

### Data Moment 1 — Spread: "How split was the room?"

**Main visual:** For each of the three questions, a bar shows how many people picked each option, and a **"Split meter"** says how divided the room was: *near-even split*, *leaning one way*, or *strong favourite*.

**Callout example:** "Question 2 was a near four-way split. Question 3 had a clear favourite."

**One-line idea:** *Spread* is how different people's answers are. Data scientists measure it to know whether an average tells the whole story.

**Link to the game:** "The rarer your answer, the more surprising it was. That is what the game scored."

**Optional extra:** A histogram of everyone's round score with a line showing the survival cutoff. "This is the cutoff, and here is where you are."

**Optional extra 2:** "If a different 150 students had walked in, this percentage could move by about ±X points." (Plain margin of error.)

**Real-world line:** Polls, product surveys and A/B tests all start by asking how spread out the answers are.

**Phone card:** "Only 18% of the room chose your answer to Q2."

---

### Data Moment 2 — Patterns: "Which answers go together?"

**Main visual:** Two columns of answers (one question on the left, one on the right) with ribbons between them. The thickest highlighted ribbon is the strongest pattern found, written as a sentence:

> "People who chose **B** on Q4 were **1.8× as likely** to choose **D** on Q6."

**One-line idea:** A *pattern* is when two things tend to happen together. It does not mean one causes the other.

**Always on screen:** "Patterns in a small room can be coincidence."

**Optional extra: "Can a room guess itself?"** Before Q6, everyone does an unscored tap: "Which option will be most popular?" The projector then shows the room's guess vs the real result.

**Real-world line:** "People who bought this also bought that" on shopping and streaming apps.

**Phone card:** "9 people (6%) answered both Q4 and Q6 exactly like you."

**If no strong pattern exists:** Show: "No strong patterns in this room, and finding that out is also data science."

---

### Data Moment 3 — Groups: "Who answered like you?"

**Main visual:** The **Map of the Room**. Each participant is a dot. People who answered similarly sit close together. The dots glide into place, then colour into 2–4 **groups**. Each group gets a label such as "Often chose: evidence-first answers", never a personality name.

On each phone: **"You are here"** with the participant's own dot highlighted. The projector never shows names.

**One-line idea:** Finding *groups* of similar people in data helps companies understand different kinds of users.

**Always on screen:** "Groups describe answer patterns, not personality types."

**Optional extra:** Replay the map being built question by question to show structure appearing as more data arrives.

**Real-world line:** Music apps group listeners with similar taste to build playlists.

**Phone card:** "You are here. 7 people answered at least 7 of 9 questions like you."

**If no clear groups exist:** Show the map without colours: "This room is a smooth spread, with no obvious groups."

---

### Data Moment 4 — Prediction: "Can a computer guess your answer?"

**Main visual:** Two bars compare how often each method correctly guessed everyone's Q12 answer:

1. **Lazy guess:** always guess the most popular option.
2. **Smart guess:** look at the 5 people whose earlier answers were most like yours, and copy their most common Q12 answer.

The computer never sees a person's own Q12 answer when guessing it.

**One-line idea:** A *prediction* is only impressive if it beats the lazy guess.

**Result messages (pick by data):**
- Smart beats lazy by a clear margin: "The computer learned something real from your earlier answers."
- Otherwise: "The computer was no better than the lazy guess. Your choices are hard to predict, and that is a result too."

**Real-world line:** Recommendations, fraud alerts and weather forecasts are predictions that must beat a simple baseline.

**Phone card:** "The computer gave your actual answer a 23% chance."

**Do not teach overfitting here.** Finale Q15 tests it, and teaching it first would give finalists the answer.

---

## 6. Question Bank

The first four rounds are dilemma questions with no correct answer. The aim is to study choices, not judge them. **Each dilemma question has exactly 4 options (A–D)**, which keeps the analysis and charts consistent.

### Round 1 — Identity & Ambition

**Q1. You can guarantee one of these outcomes. Which would you choose?**
- A. Become world-class at something you genuinely love.
- B. Become wealthy enough to never worry about money.
- C. Build something that millions of people use.
- D. Have complete freedom over your time, even without fame or wealth.

**Q2. You have one year to become exceptionally good at something. What's your strategy?**
- A. Master one skill through deliberate practice.
- B. Explore multiple fields until something clicks.
- C. Study what successful people are doing and replicate their methods.
- D. Build real projects and learn by failing repeatedly.

**Q3. Everyone around you is following a path that appears successful. You suspect it's wrong for you.**
- A. Follow it anyway; proven paths reduce risk.
- B. Take a different path, even if nobody understands it.
- C. Test both paths on a small scale before committing.
- D. Ask people you trust to challenge your assumptions.

### Round 2 — AI & Intelligence

**Q4. An AI can produce excellent work in seconds. What becomes most valuable to you?**
- A. Knowing how to use the tool better than everyone else.
- B. Knowing when its output is wrong.
- C. Asking questions that lead to original ideas.
- D. Understanding the underlying subject deeply enough to improve its output.

**Q5. You can finish an important project in one hour using AI, or spend six hours building it yourself. The result will be equally good.**
- A. Use AI and invest the remaining time elsewhere.
- B. Build it myself because the learning matters.
- C. Use AI, then rebuild the parts I don't understand.
- D. Use AI but spend the extra time testing how robust the result is.

**Q6. Two people disagree. One has ten years of experience; the other has data supporting their argument. Whom do you trust?**
- A. The experienced person; expertise matters.
- B. The data; evidence should win.
- C. Neither until I understand how the evidence was collected.
- D. Both could be right; I want to understand the assumptions behind each.

*(Optional: an unscored "guess the most popular option" tap comes before Q6.)*

### Round 3 — Social Psychology

**Q7. You believe your entire friend group is wrong about something important.**
- A. Speak up immediately, even if it causes conflict.
- B. Gather evidence before challenging them.
- C. Discuss it privately with one person first.
- D. Let it go unless the consequences are serious.

**Q8. A teammate contributes less but has faced circumstances beyond their control. The group will receive one shared grade.**
- A. Everyone receives the same grade; the outcome is collective.
- B. Grades should reflect individual contributions.
- C. Give everyone a chance to explain before deciding.
- D. Adjust responsibilities and find a fair way to assess the final work.

**Q9. A poll shows that 90% of your classmates support a decision you dislike. What would most influence you?**
- A. The majority's confidence.
- B. The quality of the arguments supporting it.
- C. Whether independent evidence supports it.
- D. The potential consequences if the majority is wrong.

### Round 4 — Risk & Uncertainty

**Q10. You have a promising opportunity with a 60% chance of success and a meaningful cost if it fails.**
- A. Take it; the upside justifies the risk.
- B. Reduce the downside before committing.
- C. Gather more information, even if the opportunity might disappear.
- D. Reject it unless failure would be easy to recover from.

**Q11. A model predicts your startup idea will fail. What do you do?**
- A. Abandon the idea; the model has analyzed more data than I can.
- B. Inspect the data and assumptions before deciding.
- C. Run a small real-world experiment.
- D. Continue if I have a strong reason to believe the model missed something.

**Q12. You must choose between two uncertain futures.**
- A. A predictable career with steady growth.
- B. A high-risk path with a chance of extraordinary success.
- C. A flexible path that lets you change direction frequently.
- D. A collaborative path where success depends on a strong team.

**Note on analysis:** these are interpretations of answers, not proven personality traits. Do not call anyone intelligent, ethical or independent because of what they chose, and do not treat a hypothetical answer as a forecast of real behaviour.

---

## 7. Finale — Data Showdown

The finale uses objectively scored questions. Rank finalists by correct answers, then by the announced tie-breakers.

### Q13. The recommendation system

A website's recommendation update increases watch time by 20%, but the number of users who return the next day drops by 15%. What is the strongest conclusion?

- A. The update is definitely successful.
- B. The update is definitely a failure.
- C. Watch time improved, but overall success is unclear without deciding which metrics matter and investigating the retention drop.
- D. The data must be incorrect because the metrics disagree.

**Answer: C.**

### Q14. The base-rate trap

A test identifies 90% of people who have a certain condition, but the condition is rare. Does a positive test necessarily mean that a person probably has the condition?

- A. Yes, because the test is 90% accurate.
- B. No; the base rate and false-positive rate also matter.
- C. Yes, if the person is young.
- D. There is never enough information to answer.

**Answer: B.** A general statistics puzzle, not medical advice.

### Q15. The final data decision

A model performs well on the data used to train it but performs poorly on new examples. What is the most likely concern?

- A. The model may be overfitting.
- B. The model must be perfect.
- C. The new data must be fake.
- D. Accuracy cannot be measured on new examples.

**Answer: A.**

### Tie-breaker

A dataset has 1,000 rows. Two hundred are duplicates that should be removed. How many rows remain, assuming exactly 200 rows are duplicate entries to remove?

- A. 200  
- B. 800  
- C. 1,000  
- D. 1,200  

**Answer: B (800).**

Prepare one or two spare tie-breakers. Tie-break order: correct answers, then total time on correct answers, then the tie-breaker question, then a spare.

> **Keep the finale answers secret:** no data moment before the finale may teach base rates, metric trade-offs or overfitting.

---

## 8. Elimination Algorithm

### Rule: round rarity score

For each question, find the share of players who chose each option. For participant $i$ on question $q$:

$$r_{iq}=-\log(p_{iq})$$

where $p_{iq}$ is the share of valid responses that chose the participant's option. The round score is the average over the round's three questions:

$$R_i=\frac{r_{i1}+r_{i2}+r_{i3}}{3}$$

A higher score means less common answers. Use a small smoothing constant so tiny groups don't create extreme scores.

**Clarified:** shares are calculated from **all** valid players (active and Analyst Mode) for a more stable sample. Only active players are ranked.

### Procedure

1. Close all three questions before showing any results.
2. Count the answers and calculate scores on the **server**.
3. Rank active players by score, highest first.
4. Advance the host-configured number; settle ties with the pre-announced rule.
5. Reveal survivors and the charts.
6. **Compute and preview the data moment.**
7. Move eliminated players to Analyst Mode.

### Decisions to make before the event

- Unanswered questions: recommended rule is that missing answers are scored at half the room's average rarity for that question.
- Do not show live vote counts before voting closes.
- Hidden risk: a player who always picks whatever seems rarest could game this rule. Simulate it (Section 12) and decide if it needs adjusting.

---

## 9. Spotify Wrapped-Inspired Personal Summary

A story-style page with big type, bold percentages and gradient cards, one insight per card.

| Card | Content |
|---|---|
| 1. Your thinking style | A playful label from simple rules (e.g. Evidence Hunter, Experimenter, Independent Builder, Systems Thinker, Strategic Planner). Show "Your thinking is a mix" if no label clearly fits. |
| 2. Your rarest choice | "Only 12% of this room chose your answer." (with the count) |
| 3. Your decision pattern | The actual answers that support the description |
| 4. You vs the room | "You differed from the most common answer on 7 of 12 questions." |
| 5. **Your place on the map (new)** | A small Map of the Room with your dot and your group's most common answers |
| 6. Your share card | Nickname (optional), label, one real statistic, one insight, club branding |

Labels are informal, not validated psychology. Participants control sharing.

---

## 10. Closing Recap — "The Room Decoded" (about 2–3 minutes)

After winners are announced, replay one thumbnail from each data moment and tie them together:

1. **Spread:** "Some questions split you. Others didn't."
2. **Patterns:** "Some answers went together. We checked, and it could be coincidence."
3. **Groups:** "You formed a map you didn't know you were drawing."
4. **Prediction:** "A computer tried to guess you. Sometimes it could, sometimes it couldn't."

**Optional "Luck check" (while finale is scored):** replay the elimination many times with slightly different rooms and show each finalist "In 100 replays, you survived X times." Plain message: *"Even a game with rules has some luck."*

### Suggested host closing

> "We didn't give you a personality. We asked questions, gathered your answers, and found patterns no single answer could show.
>
> Some of you were with the majority on one question and against it on the next. That's why data science is interesting: the story is in how the pieces connect.
>
> Your answers created the dataset. And this experience was built by our Data Science Club."

**Never show made-up numbers live.** Rehearsal data must carry a **SIMULATED DATA** watermark.

---

## 11. Privacy and Fairness

- At joining, tell players their answers are used for an anonymous group demonstration, including charts and maps on the projector.
- No emails, phone numbers or student IDs. Random participant IDs.
- **No nicknames or individual answer patterns on the projector in any data moment.** "You are here" appears only on the player's own phone.
- **Hide any group or table with fewer than 5 people.**
- Keep personal results private unless the player chooses to share.
- Always show sample size. Say that this is a small, self-selected room and does not represent a generation.
- Don't use answers to claim anything about intelligence, mental health, ethics or future success.
- Clients must never read raw answers; they receive only their own data and group totals.
- Delete raw responses after the event unless you announce otherwise.
- Test 200 simulated players. Prepare a backup QR, a hotspot and a manual fallback.

---

## 12. Website Build Plan

### 12.1 Three screens

**Player (phone):** join, answer, timer, status, optional prediction tap, data-moment card, Analyst Mode, Wrapped summary.

**Host dashboard:** start/pause/close voting; reveal results; set survivor targets; lock survivors; run tie-breakers; **preview and play each data moment; skip optional extras; switch to fallback image**; trigger winners and recap.

**Projector:** big question text, countdown, animated bars, survivor counts, data-moment scenes, winner reveal. Text must be readable from the back row.

### 12.2 Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, React, Tailwind CSS |
| Backend/DB | Supabase (database, auth, realtime) |
| Animation | Framer Motion |
| Charts | D3 or a React chart library, with custom SVG for the map |
| Calculations | A TypeScript `/lib/analytics` folder (libraries: `simple-statistics`, `ml-pca`, `ml-kmeans`) |
| Tests | Vitest |
| Load test | k6 or Artillery |

Calculations run on the server so nothing heavy happens on a phone or the projector.

### 12.3 Tables

| Table | Purpose |
|---|---|
| `participants` | Random ID, nickname, join time, status (active / analyst) |
| `questions` | Prompt, options, round, timer, type, objective answer key (server only) |
| `responses` | Participant, question, answer, time (one per participant per question) |
| `predictions` | Optional "guess the popular option" taps (unscored) |
| `game_state` | Current round, question, voting status, targets, current projector scene, mode |
| `scores` | Round scores, finale points, rank |
| `data_moments` | Computed result per round (JSON), status: computing / ready / shown, sample size |

Rules: phones can read only their own data and group totals. The host area requires login. Server keys never appear in frontend code.

### 12.4 What the engine calculates (and what the audience hears)

| Data moment | What the code does | What the screen calls it |
|---|---|---|
| 1 | Share per option; "split" level from how large the top option's share is; round score histogram; margin of error | "Split meter", "Spread" |
| 2 | Compare every pair of questions; for the strongest pair, compute "how many times more likely" (the ratio of the two chances); run a quick shuffle check behind the scenes to flag possible coincidence | "Pattern" |
| 3 | Turn answers into numbers (one-hot), squash to 2D (PCA) for the map; find 2–4 groups (k-means); list each group's most over-represented answers | "Map", "Groups" |
| 4 | Predict Q12 for each person using the 5 most similar people who did **not** include that person (leave-one-out), compare with always guessing the top option | "Lazy guess" vs "Smart guess" |

**Minimum sample sizes:** Moment 1 needs 20 answers; Moments 2 and 3 need 40; Moment 4 needs 60. Below the minimum, show only the bars and say why.

**Timing:** all four calculations must finish in under 3 seconds at 200 participants. Use fixed random seeds so results can be repeated.

### 12.5 Projector scenes

The projector follows a **scene state**, so a refresh brings it back to the right place. A round looks like:

`Question 1` → `Question 2` → `Question 3` → `Closed` → `Results` → `Survivors` → `Data moment` → `Next round`

**Host keys:** Space = next, ← = back, E = toggle extras, T = short mode, F = fallback image, P = pause timer.

Each data moment has a **pre-made fallback image** (watermarked SIMULATED DATA) in case live calculation fails; the host should say so if it's used.

### 12.6 Visual summary

| Moment | Main visual | Phone |
|---|---|---|
| 1 Spread | Bars + split meter; optional score histogram with cutoff line | "Only 18% chose your answer" |
| 2 Patterns | Ribbon chart between two questions | "9 people answered like you" |
| 3 Groups | Dot map coloured by group | "You are here" |
| 4 Prediction | Two bars: lazy guess vs smart guess | "Your answer got 23%" |

Design: one dark gradient theme with club colours; max 4–5 colours on the map, colour-blind-safe and always labelled.

### 12.7 Key routes

| Route | Purpose |
|---|---|
| `/api/join`, `/api/answer`, `/api/predict` | Player actions (answers are idempotent and rejected after close) |
| `/api/me` | Own status and data-moment card |
| `/api/host/...` | Host controls: state, close round, preview/play moment |
| `/api/screen/snapshot` | Latest data for the projector |

### 12.8 Reliability

- Duplicate submissions return the stored answer; late ones are rejected.
- The server owns the timer.
- Players reconnect with a saved token.
- Keep requests small; test on venue Wi-Fi; have a hotspot.
- The host can enter cutoffs manually if the app fails.

---

## 13. Simulation Plan

### 13.1 Before the event (tech team)

Build one small script, `simulateAudience(n, scenario, seed)`, that makes fake players with 12 answers each. Use these seven scenarios:

| Scenario | Purpose |
|---|---|
| Even split | Everyone random; checks "no patterns" screens |
| One clear favourite | 70–90% pick the same option; checks scoring and ties |
| Almost everyone agrees | Edge case for rare-answer scoring |
| Hidden groups | 3–4 made-up "types" of people; checks that Patterns, Groups and Prediction find something |
| Weak groups | Same as above but very noisy; checks the "no clear pattern" screens |
| Small room | 25, 40 and 60 people; checks minimum sample rules |
| Missing answers | 10–30% skipped questions and late joiners |

Then run these checks:

1. **Elimination test:** play 10,000 fake games per scenario. Goal: final-round survivors in the 15–20 range in at least 90% of "hidden groups" runs at n = 150, ties always resolved the same way.
2. **"Sneaky player" test:** include a bot that always picks the rarest option and a bot that picks randomly. See how far each gets, then decide if the rule needs adjusting.
3. **Calculation checks:** small hand-checked examples for percentages, the "times more likely" ratio and the prediction score; property checks (shares sum to 100%, scores are never negative); same seed gives the same result.
4. **Screen check:** every data moment renders sensibly in every scenario, including the "no pattern" versions. Save screenshots to catch accidental changes.
5. **Load test:** 200 fake phones join within a minute and answer within 20 seconds. Include dropped connections, duplicate taps, late taps and a projector refresh. Goal: no lost or duplicated answers.
6. **Full rehearsal:** 20–40 club members on real phones at the real venue with a stopwatch, in both normal and short mode.

### 13.2 On stage (the audience sees these)

These are simple, real calculations made visible:

| What the audience sees | Behind the scenes |
|---|---|
| "If another 150 students came, this number could move by ±X" | Margin of error |
| "We shuffled the answers at random. Patterns this strong showed up only X% of the time." | Shuffle check (optional, shown as a simple badge: *likely real* or *could be chance*) |
| "Replay the game 100 times" (Luck check) | Re-run the elimination with slightly different rooms |

Store the random seed with every result so numbers can be re-created after the event.

---

## 14. Timeline and Roles

The date is not fixed, so the plan counts back from the event (T-minus).

| Phase | When | Deliverables | Owner |
|---|---|---|---|
| Content freeze | T-6 weeks | Final questions, scoring rules, data-moment storyboards, host script, privacy text | Game design lead + host |
| Core game | T-6 to T-4 | Join, answer, timer, host controls, scores, Analyst Mode | Backend + frontend |
| Calculations | T-5 to T-3 | `/lib/analytics`, fake-audience script, elimination tests | Analytics lead |
| Projector scenes | T-4 to T-2 | Scene player, four data moments, recap | Viz dev + designer |
| Phone cards + Wrapped | T-3 to T-2 | Data-moment cards, Wrapped cards | Frontend + designer |
| Hardening | T-2 to T-1 | Load tests, fallback images, security check | QA + backend |
| Rehearsals | T-2 days and T-1 day | Dress rehearsals with club members, venue test | Everyone |
| Event day | T-0 | Warm-up, Wi-Fi check, backup QR | Tech lead + host |

**Roles:** Host/presenter · Game design lead · Backend dev · Player-frontend dev · Projector/viz dev · Analytics lead · Designer · QA/ops. Name one owner each. The analytics lead reads all on-screen wording to check it is accurate (e.g. never "causes", always show n).

---

## 15. Checklist

### Game design
- [ ] Finalize questions (4 options each) and round themes.
- [ ] Set survivor targets, tie-breakers and prize count (max 20).
- [ ] Write the four data-moment storyboards and host lines.
- [ ] Choose normal vs short mode.
- [ ] Decide whether to keep the pre-Q6 "guess the popular option" tap.
- [ ] Define the Wrapped label rules.

### Website
- [ ] Player, host and projector screens.
- [ ] Server-side scoring and survivors; Analyst Mode.
- [ ] The four data-moment calculations, scenes, and phone cards.
- [ ] Fallback images and host keys.
- [ ] Wrapped summary and sharing controls.
- [ ] Tests for timers, duplicates, ties and reconnects.

### Testing and rehearsal
- [ ] Fake-audience script with all seven scenarios.
- [ ] Elimination test and sneaky-player test reviewed.
- [ ] Every data moment checked in every scenario.
- [ ] 200-player load test.
- [ ] Two rehearsals, one at the venue.
- [ ] Objective answer keys double-checked.
- [ ] SIMULATED DATA watermark on all rehearsal visuals.
- [ ] Data-deletion statement included in the joining screen.

---

## 16. Go / No-Go and Risks

**Go criteria**
1. 200 simulated players finish a game with no lost or duplicated answers.
2. All four data moments work in all seven scenarios.
3. A refresh of the projector or a phone returns to the right place.
4. A rehearsal finishes within the chosen time.
5. No nicknames or individual patterns appear in any data moment.
6. The host can switch any data moment to its fallback with one key.

| Risk | Mitigation |
|---|---|
| Venue Wi-Fi struggles | Hotspot, small requests, venue test |
| Real data shows no patterns | "No pattern" screens and host lines; framing that this is a finding |
| Event runs long | Short mode; skip extras |
| Players game the rarity rule | Hide live counts; run the sneaky-player test; adjust the rule |
| Groups misread as personality types | On-screen caution; no personality names |
| Calculation bug live | Tests, fixed seeds, fallback images |
| Too few people late in the game | Analyst Mode answers count in all data moments |

---

## 17. Final Recommendation

DATA SURVIVOR works best with three simple parts: a **rare-answer survival game**, **four short, plain-language data moments** that make students feel their answers matter, and a **personal summary** each person can keep.

The game keeps them playing, the data moments show them what data science does, and the summary gives them something to remember.

**DATA SURVIVOR — Your Generation, Decoded.**

*DECODE. DISCOVER. DRIVE.*
