// Nicknames are shown only to their owner and (if approved) on the winners screen.
// This list is a first line of defence; the host can still hide a winner's name.
// Matched anywhere in the name (letters only), e.g. "f.u.c.k" is caught.
const ANYWHERE = ["fuck", "shit", "bitch", "cunt", "nigg", "chutiya", "chutia", "madarchod", "behenchod", "bhenchod", "bhosdi", "gandu", "randi", "bsdk"];
// Matched as whole words only, to avoid blocking innocent names like "Grapes" or "Essex".
const WORDS = ["dick", "sex", "porn", "rape", "slut", "whore", "fag", "pussy", "bc", "mc", "lund", "harami", "lodu", "loda", "lavda", "lawda", "chod"];

// Control characters, zero-width characters and text-direction overrides.
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g;

export function cleanNickname(raw: string): string {
  const name = raw.normalize("NFKC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim().slice(0, 16).trim();
  const squashed = name.toLowerCase().replace(/[^a-z]/g, "");
  const words = name.toLowerCase().split(/[^a-z]+/);
  const bad = ANYWHERE.some((w) => squashed.includes(w)) || WORDS.some((w) => words.includes(w));
  return !name || bad ? `Player ${Math.floor(100 + Math.random() * 900)}` : name;
}
