import type { OptionKey } from "../shared/questions";

// SERVER ONLY. scripts/check-bundle.mjs fails the build if this marker
// ever shows up in the browser bundle.
export const SERVER_ONLY_MARKER = "DS_SERVER_ONLY_7f3a9c";

export const FINALE_ANSWER_KEY: Record<string, OptionKey> = {
  f1: "C",
  f2: "B",
  f3: "A",
  tb: "B",
};
