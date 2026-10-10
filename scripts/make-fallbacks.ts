// Builds the projector's fallback data moments from a SIMULATED audience (watermarked on screen).
// Run: npx tsx scripts/make-fallbacks.ts
import { writeFileSync } from "node:fs";
import { simulateAudience } from "../server/sim/audience";
import { momentForRound } from "../server/analytics/moments";
import { DILEMMA_QUESTIONS } from "../shared/questions";

const audience = simulateAudience(150, "hidden_groups", 2026);
const answers = new Map(audience.players.map((p) => [p.id, Object.fromEntries(DILEMMA_QUESTIONS.map((q) => [q.id, p.answers[q.id].option]))]));
const out: Record<number, unknown> = {};
for (const r of [1, 2, 3, 4]) out[r] = JSON.parse(JSON.stringify(momentForRound(answers, r)));
writeFileSync("web/src/screen/fallbackMoments.json", JSON.stringify(out));
console.log("kinds:", Object.values(out).map((m: any) => m.kind).join(", "));
