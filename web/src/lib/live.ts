import { io, type Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";

/** One socket per page. Polling first, then upgrade — survives networks that block WebSockets. */
export function makeSocket(): Socket {
  return io({ reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 3000, timeout: 10_000 });
}

export function call<T = any>(socket: Socket, ev: string, data?: unknown, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(ev, data, (err: unknown, res: T) => {
      if (err) resolve({ ok: false, error: "TIMEOUT" } as T);
      else resolve(res);
    });
  });
}

export function useConnected(socket: Socket) {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on("connect", on);
    socket.on("disconnect", off);
    // The socket may have connected before this effect subscribed.
    setConnected(socket.connected);
    return () => {
      socket.off("connect", on);
      socket.off("disconnect", off);
    };
  }, [socket]);
  return connected;
}

/** Server sends "ms remaining"; we count down locally from the moment we received it (phone clocks can be wrong). */
export function useCountdown(msRemaining: number, running: boolean, stamp: unknown) {
  const deadline = useRef(0);
  const [left, setLeft] = useState(msRemaining);
  useEffect(() => {
    deadline.current = performance.now() + msRemaining;
    setLeft(msRemaining);
    if (!running) return;
    let raf = 0;
    const loop = () => {
      const l = Math.max(0, deadline.current - performance.now());
      setLeft(l);
      if (l > 0) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [msRemaining, running, stamp]);
  return left;
}

export const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: the rejoin code is the fallback */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const OPTION_COLOR: Record<string, string> = {
  A: "var(--color-opt-a)",
  B: "var(--color-opt-b)",
  C: "var(--color-opt-c)",
  D: "var(--color-opt-d)",
};
export const OPTION_HEX: Record<string, string> = { A: "#3987e5", B: "#d95926", C: "#199e70", D: "#c98500" };
/** Room-map groups: max 3, validated colour-blind-safe as scatter dots on the dark surface. */
export const GROUP_HEX = ["#3987e5", "#d95926", "#199e70"];
export const NEUTRAL_DOT = "#6f6a80";

export const ROUND_THEMES: Record<number, string> = {
  1: "Identity & Ambition",
  2: "AI & Intelligence",
  3: "Social Psychology",
  4: "Risk & Uncertainty",
  5: "Data Showdown",
};

export const MOMENT_COPY: Record<number, { ask: string; idea: string; world: string }> = {
  1: {
    ask: "How split was the room?",
    idea: "Spread is how different people's answers are.",
    world: "Polls, product surveys and A/B tests all start by asking how spread out the answers are.",
  },
  2: {
    ask: "Which answers go together?",
    idea: "A pattern is when two things tend to happen together. It doesn't mean one leads to the other.",
    world: "\"People who bought this also bought that\" on shopping and streaming apps.",
  },
  3: {
    ask: "Who answered like you?",
    idea: "Finding groups of similar people helps companies understand different kinds of users.",
    world: "Music apps group listeners with similar taste to build playlists.",
  },
  4: {
    ask: "Can a computer guess your answer?",
    idea: "A prediction is only impressive if it beats the lazy guess.",
    world: "Recommendations, fraud alerts and weather forecasts must all beat a simple baseline.",
  },
};

export function qNumber(qid: string): string {
  if (qid.startsWith("q")) return `Q${qid.slice(1)}`;
  if (qid === "tb") return "Bonus";
  return `F${qid.slice(1)}`;
}
