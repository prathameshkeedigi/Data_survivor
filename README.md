# DATA SURVIVOR

A live, phone-based game for the Data Science Club orientation. Students answer dilemma questions, rare answers survive, the projector turns the room's answers into live data stories, and everyone gets a Spotify Wrapped-style summary at the end.

| URL | Who |
|---|---|
| `/` | Players (phones) |
| `/screen` | Projector (`/screen?preview=1..4` previews the charts) |
| `/host` | Presenter controls (password) |

## Run locally

```bash
npm ci
npm run build
HOST_PASSWORD=pick-a-password npm start      # http://localhost:3000
```

## Tests (test-driven: specs live in docs/BUILD_PHASES.md)

```bash
npm test            # unit + integration (≈75 tests, includes 2,000 simulated games)
npm run test:fast   # same, without the long simulation
npm run test:e2e    # real browsers: host + 2 projectors + 3 phones play a full game
npx tsx scripts/swarm.ts --url http://localhost:3000 --password pick-a-password --n 500 --reset   # load test
```

## Docs

- [Execution plan](docs/EXECUTION_PLAN.md): what, why, architecture and risks
- [Build phases & test cases](docs/BUILD_PHASES.md)
- [Deploy](docs/DEPLOY.md): AWS, Railway or Render
- [Event-day runbook](docs/RUNBOOK.md)
- [Original proposal](docs/PROPOSAL_v3.md)

## Layout

```
server/   game engine, live server, analytics (data moments, Wrapped)
shared/   question bank and the types the browser sees
web/      React pages: play, screen, host
scripts/  load-test swarm, screen capture, fallback chart generator
tests/    unit + integration (Vitest)   tests-e2e/  browser tests (Playwright)
```
