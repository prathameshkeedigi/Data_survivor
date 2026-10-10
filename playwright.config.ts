import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests-e2e",
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && node dist/server.js",
    url: "http://127.0.0.1:4173/health",
    timeout: 120_000,
    reuseExistingServer: false,
    env: { HOST_PASSWORD: "e2e-pass-123", PORT: "4173", QUESTION_MS: "8000", FINALE_MS: "8000" },
  },
});
