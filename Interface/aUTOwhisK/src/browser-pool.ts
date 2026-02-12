#!/usr/bin/env bun

import puppeteer, { Browser } from "puppeteer-core";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const SITE_KEY = "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV";
const GPM_PORT_RANGE = [19995, 19990, 19991, 19992, 19993, 19994, 19996, 19997, 19998, 19999];
const CONNECT_RETRY_COUNT = 5;
const CONNECT_RETRY_DELAY = 3000;

const DATA_DIR = process.env.APPDATA ? join(process.env.APPDATA, "cookie-capture") : "./data";
const POOL_FILE = join(DATA_DIR, "browser-pool.json");

interface PooledBrowser {
  accountId: string;
  profileId: string;
  gpmApiUrl: string;
  debugAddress: string;
  status: "ready" | "busy" | "error";
  lastUsed: number;
  createdAt: number;
}

interface BrowserPool {
  browsers: Record<string, PooledBrowser>;
  gpmApiUrl: string | null;
}

async function loadPool(): Promise<BrowserPool> {
  try {
    if (existsSync(POOL_FILE)) {
      return await Bun.file(POOL_FILE).json();
    }
  } catch {}
  return { browsers: {}, gpmApiUrl: null };
}

async function savePool(pool: BrowserPool) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  await Bun.write(POOL_FILE, JSON.stringify(pool, null, 2));
}

async function findGpmApiUrl(): Promise<string | null> {
  for (const port of GPM_PORT_RANGE) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v3/profiles`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return `http://127.0.0.1:${port}/api/v3`;
    } catch {}
  }
  return null;
}

function parseCookies(cookieString: string) {
  const cookies: any[] = [];
  for (const pair of cookieString.split("; ")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.substring(0, idx).trim();
    const value = pair.substring(idx + 1);
    if (!name || !value) continue;
    const isSecure = name.startsWith("__Secure-") || name.startsWith("__Host-");
    cookies.push({
      name, value,
      domain: name.startsWith("__Host-") ? "labs.google" : ".labs.google",
      path: "/", secure: isSecure, httpOnly: true, sameSite: "Lax" as const,
    });
  }
  return cookies;
}

async function loadAccount(accountId: string): Promise<any | null> {
  const ACCOUNTS_DIR = join(DATA_DIR, "accounts");
  const path = join(ACCOUNTS_DIR, `veo3-${accountId}.json`);
  if (!existsSync(path)) return null;
  try {
    const fileData = await Bun.file(path).json();
    if (fileData._encrypted && fileData.data) {
      try {
        const { decryptObject } = await import("../../test/cookie-capture/crypto");
        return decryptObject(fileData.data);
      } catch {
        return { http: {}, credits: fileData.credits, email: fileData.email };
      }
    }
    return fileData;
  } catch { return null; }
}

async function addBrowserToPool(accountId: string): Promise<PooledBrowser | null> {
  const pool = await loadPool();
  
  if (pool.browsers[accountId]?.status === "ready") {
    console.error(`[Pool] Browser for ${accountId} already in pool`);
    return pool.browsers[accountId];
  }

  const accountData = await loadAccount(accountId);
  if (!accountData?.http?.headers?.Cookie) {
    console.error(`[Pool] No cookies for ${accountId}`);
    return null;
  }

  let gpmApiUrl = pool.gpmApiUrl || await findGpmApiUrl();
  if (!gpmApiUrl) {
    console.error(`[Pool] GPM not running`);
    return null;
  }
  pool.gpmApiUrl = gpmApiUrl;

  const profileName = `pool_${accountId}_${Date.now()}`;
  const createRes = await fetch(`${gpmApiUrl}/profiles/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_name: profileName,
      group_name: "veo3-pool",
      browser_core: "chromium",
      browser_name: "Chrome",
      is_noise_canvas: true,
      is_noise_webgl: true,
      is_noise_audio_context: true,
    }),
  });
  const createData = (await createRes.json()) as any;
  if (!createData.success) {
    console.error(`[Pool] Failed to create profile: ${JSON.stringify(createData)}`);
    return null;
  }
  const profileId = createData.data.id;
  console.error(`[Pool] Created profile: ${profileId}`);

  const openRes = await fetch(`${gpmApiUrl}/profiles/start/${profileId}?win_size=400,400&win_pos=0,0`);
  const openData = (await openRes.json()) as any;
  if (!openData.success) {
    console.error(`[Pool] Failed to start profile`);
    return null;
  }
  const debugAddress = openData.data.remote_debugging_address;
  console.error(`[Pool] Started: ${debugAddress}`);

  let browser: Browser | null = null;
  for (let i = 0; i < CONNECT_RETRY_COUNT; i++) {
    try {
      await new Promise(r => setTimeout(r, CONNECT_RETRY_DELAY));
      browser = await puppeteer.connect({
        browserURL: `http://${debugAddress}`,
        defaultViewport: null,
        protocolTimeout: 60000,
      });
      break;
    } catch (e: any) {
      if (i === CONNECT_RETRY_COUNT - 1) {
        console.error(`[Pool] Failed to connect after ${CONNECT_RETRY_COUNT} attempts`);
        await fetch(`${gpmApiUrl}/profiles/close/${profileId}`);
        await fetch(`${gpmApiUrl}/profiles/delete/${profileId}?mode=2`);
        return null;
      }
    }
  }

  const pages = await browser!.pages();
  const page = pages[0] || await browser!.newPage();

  await page.goto("https://labs.google", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.setCookie(...parseCookies(accountData.http.headers.Cookie));
  await page.goto("https://labs.google/fx/tools/flow", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  const hasRecaptcha = await page.evaluate(() => !!(window as any).grecaptcha?.enterprise);
  if (!hasRecaptcha) {
    console.error(`[Pool] Cookie expired for ${accountId}`);
    browser!.disconnect();
    await fetch(`${gpmApiUrl}/profiles/close/${profileId}`);
    await fetch(`${gpmApiUrl}/profiles/delete/${profileId}?mode=2`);
    return null;
  }

  browser!.disconnect();

  const pooledBrowser: PooledBrowser = {
    accountId,
    profileId,
    gpmApiUrl,
    debugAddress,
    status: "ready",
    lastUsed: Date.now(),
    createdAt: Date.now(),
  };

  pool.browsers[accountId] = pooledBrowser;
  await savePool(pool);

  console.error(`[Pool] Browser ready for ${accountId}`);
  return pooledBrowser;
}


async function getTokenFromPool(accountId: string): Promise<{ auth_token: string; recaptcha_token: string } | null> {
  const pool = await loadPool();
  const pooled = pool.browsers[accountId];

  if (!pooled || pooled.status !== "ready") {
    console.error(`[Pool] No ready browser for ${accountId}`);
    return null;
  }

  pool.browsers[accountId].status = "busy";
  await savePool(pool);

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://${pooled.debugAddress}`,
      defaultViewport: null,
      protocolTimeout: 60000,
    });

    const pages = await browser.pages();
    const page = pages[0];
    if (!page) throw new Error("No page found");

    let authToken: string | null = null;
    try {
      const sessionData = await page.evaluate(async () => {
        const res = await fetch("https://labs.google/fx/api/auth/session", { credentials: "include" });
        return await res.json();
      });
      authToken = sessionData?.accessToken || sessionData?.access_token;
    } catch {}

    if (!authToken) {
      const nextData = await page.evaluate(() => {
        const el = document.getElementById("__NEXT_DATA__");
        if (el) try { return JSON.parse(el.textContent || "{}"); } catch { return null; }
        return null;
      });
      authToken = nextData?.props?.pageProps?.session?.accessToken;
    }

    if (!authToken) throw new Error("Failed to get auth token");

    const hasRecaptcha = await page.evaluate(() => !!(window as any).grecaptcha?.enterprise);
    if (!hasRecaptcha) throw new Error("reCAPTCHA not available");

    const recaptchaToken = await page.evaluate(async (siteKey: string) => {
      return await (window as any).grecaptcha.enterprise.execute(siteKey, { action: "VIDEO_GENERATION" });
    }, SITE_KEY);

    if (!recaptchaToken) throw new Error("Failed to get reCAPTCHA token");

    browser.disconnect();

    pool.browsers[accountId].status = "ready";
    pool.browsers[accountId].lastUsed = Date.now();
    await savePool(pool);

    return { auth_token: authToken, recaptcha_token: recaptchaToken };
  } catch (e: any) {
    console.error(`[Pool] Error getting token: ${e.message}`);
    if (browser) try { browser.disconnect(); } catch {}

    pool.browsers[accountId].status = "error";
    await savePool(pool);
    return null;
  }
}

async function removeBrowserFromPool(accountId: string) {
  const pool = await loadPool();
  const pooled = pool.browsers[accountId];
  if (!pooled) return;

  try {
    await fetch(`${pooled.gpmApiUrl}/profiles/close/${pooled.profileId}`);
    await fetch(`${pooled.gpmApiUrl}/profiles/delete/${pooled.profileId}?mode=2`);
  } catch {}

  delete pool.browsers[accountId];
  await savePool(pool);
  console.error(`[Pool] Removed browser for ${accountId}`);
}

async function clearPool() {
  const pool = await loadPool();
  for (const [accountId, pooled] of Object.entries(pool.browsers)) {
    try {
      await fetch(`${pooled.gpmApiUrl}/profiles/close/${pooled.profileId}`);
      await fetch(`${pooled.gpmApiUrl}/profiles/delete/${pooled.profileId}?mode=2`);
      console.error(`[Pool] Closed ${accountId}`);
    } catch {}
  }
  await savePool({ browsers: {}, gpmApiUrl: null });
  console.error(`[Pool] Cleared all browsers`);
}

async function listPool() {
  const pool = await loadPool();
  const result = Object.entries(pool.browsers).map(([id, b]) => ({
    accountId: id,
    status: b.status,
    profileId: b.profileId,
    lastUsed: b.lastUsed,
  }));
  console.log(JSON.stringify({ success: true, browsers: result }));
}

async function getReadyBrowser(): Promise<string | null> {
  const pool = await loadPool();
  for (const [accountId, browser] of Object.entries(pool.browsers)) {
    if (browser.status === "ready") return accountId;
  }
  return null;
}

async function initPoolFromAccounts(accountIds: string[]) {
  console.error(`[Pool] Initializing pool with ${accountIds.length} accounts...`);
  const results: { accountId: string; success: boolean }[] = [];

  for (const accountId of accountIds) {
    const result = await addBrowserToPool(accountId);
    results.push({ accountId, success: !!result });
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(JSON.stringify({ success: true, results }));
}

const [action, ...args] = process.argv.slice(2);

async function main() {
  switch (action) {
    case "add":
      const added = await addBrowserToPool(args[0]);
      console.log(JSON.stringify({ success: !!added, browser: added }));
      break;

    case "get-token":
      const tokens = await getTokenFromPool(args[0]);
      if (tokens) {
        console.log(JSON.stringify({ success: true, ...tokens }));
      } else {
        console.log(JSON.stringify({ success: false, message: "Failed to get token" }));
      }
      break;

    case "remove":
      await removeBrowserFromPool(args[0]);
      console.log(JSON.stringify({ success: true }));
      break;

    case "clear":
      await clearPool();
      console.log(JSON.stringify({ success: true }));
      break;

    case "list":
      await listPool();
      break;

    case "get-ready":
      const ready = await getReadyBrowser();
      console.log(JSON.stringify({ success: true, accountId: ready }));
      break;

    case "init":
      await initPoolFromAccounts(args);
      break;

    default:
      console.log(JSON.stringify({ success: false, message: `Unknown action: ${action}` }));
  }
}

main();
