// Question bank shared by server and browsers.
// NEVER put finale answer keys here — they live in server/finaleKeys.ts.

export const OPTION_KEYS = ["A", "B", "C", "D"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

// Tags drive the playful Wrapped "thinking style" label. Leads: review these.
export const WRAPPED_TAGS = ["evidence", "experiment", "independent", "systems", "strategic"] as const;
export type WrappedTag = (typeof WRAPPED_TAGS)[number];

export interface QuestionOption {
  key: OptionKey;
  text: string;
  tag?: WrappedTag;
}

export interface Question {
  id: string;
  kind: "dilemma" | "finale" | "tiebreak";
  /** 1–4 for dilemma rounds, 5 for the finale. */
  round: number;
  prompt: string;
  options: QuestionOption[];
}

type Opt = [text: string, tag?: WrappedTag];

function q(id: string, kind: Question["kind"], round: number, prompt: string, opts: [Opt, Opt, Opt, Opt]): Question {
  return {
    id,
    kind,
    round,
    prompt,
    options: opts.map(([text, tag], i) => (tag ? { key: OPTION_KEYS[i], text, tag } : { key: OPTION_KEYS[i], text })),
  };
}

export const ROUND_THEMES: Record<number, string> = {
  1: "Identity & Ambition",
  2: "AI & Intelligence",
  3: "Social Psychology",
  4: "Risk & Uncertainty",
  5: "Data Showdown",
};

export const DILEMMA_QUESTIONS: Question[] = [
  q("q1", "dilemma", 1, "You can guarantee one of these outcomes. Which would you choose?", [
    ["Become world-class at something you genuinely love.", "independent"],
    ["Become wealthy enough to never worry about money.", "strategic"],
    ["Build something that millions of people use.", "systems"],
    ["Have complete freedom over your time, even without fame or wealth.", "independent"],
  ]),
  q("q2", "dilemma", 1, "You have one year to become exceptionally good at something. What's your strategy?", [
    ["Master one skill through deliberate practice.", "strategic"],
    ["Explore multiple fields until something clicks.", "experiment"],
    ["Study what successful people are doing and replicate their methods.", "evidence"],
    ["Build real projects and learn by failing repeatedly.", "independent"],
  ]),
  q("q3", "dilemma", 1, "Everyone around you is following a path that appears successful. You suspect it's wrong for you.", [
    ["Follow it anyway; proven paths reduce risk.", "strategic"],
    ["Take a different path, even if nobody understands it.", "independent"],
    ["Test both paths on a small scale before committing.", "experiment"],
    ["Ask people you trust to challenge your assumptions.", "systems"],
  ]),
  q("q4", "dilemma", 2, "An AI can produce excellent work in seconds. What becomes most valuable to you?", [
    ["Knowing how to use the tool better than everyone else.", "strategic"],
    ["Knowing when its output is wrong.", "evidence"],
    ["Asking questions that lead to original ideas.", "independent"],
    ["Understanding the subject deeply enough to improve its output.", "systems"],
  ]),
  q("q5", "dilemma", 2, "You can finish an important project in one hour using AI, or in six hours by yourself. The result is equally good.", [
    ["Use AI and invest the remaining time elsewhere.", "strategic"],
    ["Build it myself because the learning matters.", "independent"],
    ["Use AI, then rebuild the parts I don't understand.", "systems"],
    ["Use AI, then spend the extra time testing how robust it is.", "experiment"],
  ]),
  q("q6", "dilemma", 2, "Two people disagree. One has ten years of experience; the other has data supporting their argument. Whom do you trust?", [
    ["The experienced person; expertise matters.", "strategic"],
    ["The data; evidence should win.", "evidence"],
    ["Neither, until I understand how the evidence was collected.", "evidence"],
    ["Both could be right; I want to understand the assumptions behind each.", "systems"],
  ]),
  q("q7", "dilemma", 3, "You believe your entire friend group is wrong about something important.", [
    ["Speak up immediately, even if it causes conflict.", "independent"],
    ["Gather evidence before challenging them.", "evidence"],
    ["Discuss it privately with one person first.", "strategic"],
    ["Let it go unless the consequences are serious.", "systems"],
  ]),
  q("q8", "dilemma", 3, "A teammate contributes less but has faced circumstances beyond their control. The group gets one shared grade.", [
    ["Everyone receives the same grade; the outcome is collective.", "systems"],
    ["Grades should reflect individual contributions.", "evidence"],
    ["Give everyone a chance to explain before deciding.", "experiment"],
    ["Adjust responsibilities and find a fair way to assess the final work.", "strategic"],
  ]),
  q("q9", "dilemma", 3, "A poll shows 90% of your classmates support a decision you dislike. What would most influence you?", [
    ["The majority's confidence.", "strategic"],
    ["The quality of the arguments supporting it.", "systems"],
    ["Whether independent evidence supports it.", "evidence"],
    ["The potential consequences if the majority is wrong.", "systems"],
  ]),
  q("q10", "dilemma", 4, "You have a promising opportunity with a 60% chance of success and a meaningful cost if it fails.", [
    ["Take it; the upside justifies the risk.", "independent"],
    ["Reduce the downside before committing.", "strategic"],
    ["Gather more information, even if the opportunity might disappear.", "evidence"],
    ["Reject it unless failure would be easy to recover from.", "strategic"],
  ]),
  q("q11", "dilemma", 4, "A model predicts your startup idea will fail. What do you do?", [
    ["Abandon the idea; the model has analysed more data than I can.", "evidence"],
    ["Inspect the data and assumptions before deciding.", "systems"],
    ["Run a small real-world experiment.", "experiment"],
    ["Continue if I have a strong reason to believe the model missed something.", "independent"],
  ]),
  q("q12", "dilemma", 4, "You must choose between two uncertain futures.", [
    ["A predictable career with steady growth.", "strategic"],
    ["A high-risk path with a chance of extraordinary success.", "independent"],
    ["A flexible path that lets you change direction often.", "experiment"],
    ["A collaborative path where success depends on a strong team.", "systems"],
  ]),
];

export const FINALE_QUESTIONS: Question[] = [
  q("f1", "finale", 5, "A recommendation update increases watch time by 20%, but users returning the next day drop by 15%. What is the strongest conclusion?", [
    ["The update is definitely successful."],
    ["The update is definitely a failure."],
    ["Watch time improved, but overall success is unclear without deciding which metrics matter and investigating the retention drop."],
    ["The data must be incorrect because the metrics disagree."],
  ]),
  q("f2", "finale", 5, "A test catches 90% of people who have a rare condition. Does a positive test mean the person probably has it?", [
    ["Yes, because the test is 90% accurate."],
    ["No; the base rate and false-positive rate also matter."],
    ["Yes, if the person is young."],
    ["There is never enough information to answer."],
  ]),
  q("f3", "finale", 5, "A model performs well on its training data but poorly on new examples. What is the most likely concern?", [
    ["The model may be overfitting."],
    ["The model must be perfect."],
    ["The new data must be fake."],
    ["Accuracy cannot be measured on new examples."],
  ]),
  q("tb", "tiebreak", 5, "Bonus speed question: a dataset has 1,000 rows. Exactly 200 are duplicates to remove. How many rows remain?", [
    ["200"],
    ["800"],
    ["1,000"],
    ["1,200"],
  ]),
];

export const ALL_QUESTIONS: Question[] = [...DILEMMA_QUESTIONS, ...FINALE_QUESTIONS];

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(ALL_QUESTIONS.map((x) => [x.id, x]));
