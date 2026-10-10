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
});
