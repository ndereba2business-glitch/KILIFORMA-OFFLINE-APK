// Offline behaviour, checked in a real browser against the mock backend.
//
// The scenario that matters in the field: the phone shows signal, the radio is
// connected, and no request gets through. The app must still open and show the
// farmer's last-known data instead of an empty screen, and it must say so
// rather than pretend the data is current.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";

const FARMER = { email: "offline@kiliforma.test", password: "farmer-pass", role: "farmer" };

let app;
let backend;

before(async () => {
  app = await startApp({
    env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY },
  });
});

after(async () => {
  await app?.close();
});

beforeEach(() => {
  backend = createMockBackend();
  backend.addUser(FARMER);
  backend.db.tables.tasks = [];
  backend.db.tables.farmer_profiles = [];
});

async function signIn() {
  const session = await newUserPage(app.browser, { width: 390, height: 900 });
  await backend.attach(session.context);
  await session.page.goto(`${app.url}/login`, { waitUntil: "domcontentloaded" });
  await session.page.locator('input[type="email"]').fill(FARMER.email);
  await session.page.locator('input[type="password"]').fill(FARMER.password);
  await session.page.getByRole("button", { name: /^log in$/i }).click();
  await session.page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 20000 });
  return session;
}

// Cut the phone off from Supabase but leave the app itself loading, which is
// exactly "data on, no data": the radio is fine, the API is unreachable.
async function cutSupabase(context) {
  await context.route(`${MOCK_SUPABASE_URL}/rest/v1/**`, route => route.abort("failed"));
}

test("a page still shows the farmer's data when Supabase cannot be reached", { timeout: 90000 }, async () => {
  // Seeded directly, so the assertion is about the cache and not about whether
  // a form click happened to work.
  const SEED = "Collect growers mash";
  backend.db.tables.farm_tasks = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      user_email: FARMER.email,
      title: SEED,
      category: "Feeding",
      priority: "high",
      completed: false,
      due_date: null,
      created_at: new Date().toISOString(),
    },
  ];

  const { context, page } = await signIn();

  // 1. Online: the task is on screen, and the read is now cached.
  await page.goto(`${app.url}/tasks`, { waitUntil: "domcontentloaded" });
  await page.getByText(SEED).first().waitFor({ timeout: 20000 });
  assert.ok(await page.getByText(SEED).count(), "the seeded task renders while online");

  // 2. Cut the phone off from Supabase, then reload. The radio is still on;
  //    nothing gets through. This is the Facebook-Lite scenario.
  await cutSupabase(context);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  // 3. The same row must come back from the cache rather than an empty screen.
  const afterCut = await page.locator("body").innerText();
  assert.match(afterCut, new RegExp(SEED), "the cached task is still shown with no connection");

  // 4. And the app must be honest about it.
  assert.ok((await page.locator(".fc-offline").count()) >= 1, "the offline banner is shown");

  await context.close();
});

test("the offline banner is absent when the network is healthy", { timeout: 60000 }, async () => {
  const { context, page } = await signIn();
  await page.goto(`${app.url}/tasks`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  assert.equal(await page.locator(".fc-offline").count(), 0, "nothing is announced when nothing is wrong");
  await context.close();
});
