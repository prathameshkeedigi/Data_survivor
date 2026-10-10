import { loadConfig } from "../../server/config";

describe("Phase 1 — config", () => {
  it("F3a: refuses to start without HOST_PASSWORD", () => {
    expect(() => loadConfig({})).toThrow(/HOST_PASSWORD/);
  });

  it("F3b: refuses a HOST_PASSWORD shorter than 8 characters", () => {
    expect(() => loadConfig({ HOST_PASSWORD: "short" })).toThrow(/HOST_PASSWORD/);
  });

  it("F3c: valid env gives a config with port defaulting to 3000", () => {
    const c = loadConfig({ HOST_PASSWORD: "long-enough-pass" });
    expect(c.port).toBe(3000);
    expect(c.hostPassword).toBe("long-enough-pass");
    expect(loadConfig({ HOST_PASSWORD: "long-enough-pass", PORT: "8080" }).port).toBe(8080);
  });

  it("F3d: optional timing overrides are read from the environment", () => {
    const c = loadConfig({ HOST_PASSWORD: "long-enough-pass", QUESTION_MS: "15000", FINALE_MS: "30000" });
    expect(c.tuning).toEqual({ questionMs: 15000, finaleMs: 30000 });
    expect(loadConfig({ HOST_PASSWORD: "long-enough-pass" }).tuning).toEqual({});
    expect(() => loadConfig({ HOST_PASSWORD: "long-enough-pass", QUESTION_MS: "abc" })).toThrow(/QUESTION_MS/);
  });
});
