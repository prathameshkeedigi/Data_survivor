import { test, expect, type Page, type Browser } from "@playwright/test";

const PASSWORD = "e2e-pass-123";
const SHOTS = "test-results/screens";

async function scene(page: Page): Promise<string> {
  return (await page.locator("[data-scene]").first().getAttribute("data-scene")) ?? "";
}

/** U2/U3: nothing may overflow the viewport sideways (phones) or at all (projector). */
async function assertFits(page: Page, label: string, vertical = false) {
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  expect(m.sw, `${label}: horizontal overflow`).toBeLessThanOrEqual(m.w + 1);
  if (vertical) expect(m.sh, `${label}: vertical overflow`).toBeLessThanOrEqual(m.h + 1);
}

async function phone(browser: Browser, nickname: string, width = 390, height = 844) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByTestId("join-nickname").fill(nickname);
  await page.getByTestId("join-submit").click();
  await expect(page.locator('[data-scene="lobby"]')).toBeVisible();
  return page;
}

test("U1–U7: a full game across host, two projectors and three phones", async ({ browser }) => {
  // Host
  const host = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await host.goto("/host");
  await host.getByTestId("host-password").fill(PASSWORD);
  await host.getByTestId("host-login").click();
  await expect(host.locator("[data-scene]")).toBeVisible();

  // Projectors: modern 16:9 and an old 4:3
  const wide = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const old = await (await browser.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
  for (const s of [wide, old]) {
    await s.goto("/screen");
    await expect(s.locator('[data-scene="lobby"]')).toBeVisible();
  }

  // Phones: normal, small (360px), and a long emoji nickname (U7)
  const phones = [await phone(browser, "Asha"), await phone(browser, "Ben", 360, 740), await phone(browser, "😎🔥Supercalifragilistic", 390, 844)];
  await expect(wide.getByTestId("player-count")).toHaveText("3");

  const seen = new Set<string>();
  let refreshed = false;
  for (let step = 0; step < 120; step++) {
    const sc = await scene(host);
    if (!seen.has(sc)) {
      seen.add(sc);
      await wide.waitForTimeout(900); // let animations settle
      await wide.screenshot({ path: `${SHOTS}/screen-1080-${sc}.png` });
      await old.screenshot({ path: `${SHOTS}/screen-4x3-${sc}.png` });
      await phones[1].screenshot({ path: `${SHOTS}/phone-360-${sc}.png` });
      for (const [i, p] of phones.entries()) await assertFits(p, `phone ${i} @ ${sc}`);
      // Regression: connected screens must never show a "reconnecting" banner.
      for (const p of [...phones, wide, old]) await expect(p.getByTestId("reconnecting")).toHaveCount(0);
      await assertFits(wide, `screen 1080 @ ${sc}`, true);
      await assertFits(old, `screen 4:3 @ ${sc}`, true);
    }
    if (sc === "wrapped") break;

    if (sc === "question" && (await host.getByTestId("voting-open").count()) > 0) {
      for (const [i, p] of phones.entries()) {
        const btn = p.getByTestId(`option-${"ABC"[i]}`);
        if (await btn.isVisible()) {
          const box = await btn.boundingBox();
          expect(box!.height, "answer buttons are thumb-sized").toBeGreaterThanOrEqual(64);
          await btn.click();
          await expect(p.getByTestId("locked-in")).toBeVisible();
        }
      }
      // U4: refreshing a phone mid-question keeps its locked answer
      if (!refreshed) {
        refreshed = true;
        await phones[0].reload();
        await expect(phones[0].getByTestId("locked-in")).toBeVisible();
      }
    }
    if (sc === "results" && (await host.getByTestId("lock-survivors").isVisible())) {
      await host.getByTestId("lock-survivors").click();
      await host.getByTestId("confirm-yes").click();
      await expect(host.getByTestId("locked-badge")).toBeVisible();
    }
    if (sc === "finale_results" && (await host.getByTestId("lock-winners").isVisible())) {
      await host.getByTestId("lock-winners").click();
      await host.getByTestId("confirm-yes").click();
      await expect(host.getByTestId("winners-locked-badge")).toBeVisible();
    }
    await host.waitForTimeout(650);
    await host.getByTestId("host-next").click();
    await host.waitForTimeout(150);
  }

  for (const s of ["lobby", "question", "results", "survivors", "moment", "finale_intro", "finale_results", "winners", "recap", "wrapped"]) {
    expect(seen.has(s), `host passed through ${s}`).toBe(true);
  }
  await expect(wide.locator('[data-scene="winners"], [data-scene="recap"], [data-scene="wrapped"]')).toBeVisible();

  // Wrapped: every phone gets a story and can reach the share card
  for (const [i, p] of phones.entries()) {
    await expect(p.getByTestId("wrapped-card")).toBeVisible();
    for (let k = 0; k < 8 && !(await p.getByTestId("share-card").isVisible()); k++) {
      await p.getByTestId("wrapped-next").click();
      await p.waitForTimeout(250);
    }
    await expect(p.getByTestId("share-card")).toBeVisible();
    await p.screenshot({ path: `${SHOTS}/phone-${i}-share.png` });
    await assertFits(p, `phone ${i} wrapped`);
  }
});

test("U5: a phone that loses its connection recovers to the current scene", async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  await host.goto("/host");
  await host.getByTestId("host-password").fill(PASSWORD);
  await host.getByTestId("host-login").click();
  await host.getByTestId("host-reset").click();
  await host.getByTestId("reset-confirm-input").fill("RESET");
  await host.getByTestId("confirm-yes").click();
  await expect(host.locator('[data-scene="lobby"]')).toBeVisible();
  const p = await phone(browser, "Offline");
  await p.context().setOffline(true);
  await host.waitForTimeout(700);
  await host.getByTestId("host-next").click();
  await host.waitForTimeout(1500);
  await p.context().setOffline(false);
  await expect(p.locator('[data-scene="question"]')).toBeVisible({ timeout: 15_000 });
});
