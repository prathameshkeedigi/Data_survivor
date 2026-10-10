# Event-day runbook: DATA SURVIVOR

**For:** the host/presenter and the tech person at the orientation on Monday 12 October.

## The three screens

| Device | Open | Notes |
|---|---|---|
| Projector laptop | `https://<url>/screen` | Full screen (F11), zoom 100%, **Do Not Disturb on**, sleep off, charger in |
| Host device | `https://<url>/host` | Log in with the host password. Space = next, ← = back, P = pause, F = fallback chart |
| Backup host (a phone) | `https://<url>/host` | Logged in too. Use it if the main host device dies. |

## Sunday rehearsal (required)

1. Reset the game from `/host` → *Reset game…* → type `RESET`.
2. 20–40 club members join on their **own phones**, including iPhones and Androids, and through the Instagram/WhatsApp/Google Lens scanners.
3. Fill the room with bots while the real host drives:
   `npx tsx scripts/swarm.ts --url https://<url> --n 300 --passive`
4. Play the **whole** game with a stopwatch, on the **real projector laptop**.
5. Practise the failure drills below at least once: phone refresh, projector refresh, **F** fallback, and server switch.

## Monday, 2 hours before

- [ ] Open `/health`. It should show `"ok": true`.
- [ ] Projector: `/screen` in full screen. Check that the text is readable from the back row.
- [ ] Join from 2 phones: one on **campus Wi-Fi**, one on **mobile data**.
- [ ] **Final reset:** `/host` → *Reset game…* → `RESET`.
- [ ] Turn **off** "Rehearsal badge on projector".
- [ ] **No code changes or redeploys from now on.**

## Running the show

| Screen | Host says / does |
|---|---|
| Lobby | "Scan the QR code. If the Wi-Fi is slow, switch to mobile data." Wait until the player count stops rising. Optional: tick **Lock joining** once round 1 starts. |
| Question | The timer runs on the server. Press **Space** to close voting early once almost everyone has answered. |
| Results | Read one surprising bar. The host panel shows the suggested survivor count, so **Lock survivors**, then press Next. |
| Survivors | "Rarer answers survived. Everyone else is now an Analyst: keep answering, the charts need you." |
| Data moment | Read the question, the chart, *the idea* line and the real-world line. If the chart looks wrong, press **F**. |
| Finale intro | "Rarity got you here. Knowing data wins it. Correct **and fast** wins. The 4th question is a speed tie-breaker." |
| Finale results | Check the winners list in the host panel. **Hide** any offensive nickname, then **Lock winners** and press Next. |
| Winners | "Winners: show your phone at the stage. It shows WINNER and a code." Check that the code on the phone matches the host list if needed. |
| Recap → Wrapped | Read the closing lines. "Check your phone: swipe through your Wrapped and share it." |

## If something breaks

| Problem | Do this |
|---|---|
| A few phones are stuck | "Refresh the page." If they're logged out, they tap *Rejoin with your code* (the code is on their lobby screen). |
| Projector frozen or blank | Refresh `/screen`. It returns to the current scene. |
| A chart looks wrong or says *calculating* | Press **F** for the fallback chart. Say: "Here's what this looked like in rehearsal." |
| Host laptop dies | Use the backup host phone. |
| Server restarted (everyone disconnected, the game is back at the lobby) | `/host` → **Restore**. It uses the backup saved in the host browser every 5 seconds. |
| Main server completely down | Open the **standby** URL's `/host` → **Upload…** the downloaded backup (or Restore from the same browser). Show the standby URL / QR code on the projector. Phones rejoin with their code. |
| Everything down | Switch to the paper / Google Form version of the questions. |

## Tips

- **Download a backup** (`/host` → Download) after each round. It takes 2 seconds and is your insurance.
- The `/health` page shows `players`, `lagMs` and `rssMb`. If `lagMs` stays above about 300, the server is struggling, so slow down and give answers more time.
- After the event, the leads decide whether to keep anonymous totals. Otherwise, stop the server, and the data is gone.
