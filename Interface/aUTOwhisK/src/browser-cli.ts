#!/usr/bin/env bun

import puppeteer from "puppeteer-core";
import { existsSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const SITE_KEY = "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV";
const GPM_PORT_RANGE = [19995, 19990, 19991, 19992, 19993, 19994, 19996, 19997, 19998, 19999];
const CONNECT_RETRY_COUNT = 5;
const CONNECT_RETRY_DELAY = 3000;

const DATA_DIR = process.env.APPDATA
  ? join(process.env.APPDATA, "cookie-capture")
  : "./data";
const PROFILES_DIR = join(DATA_DIR, "profiles");
const ACCOUNTS_DIR = join(DATA_DIR, "accounts");

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];

function ensureDirs() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });
  if (!existsSync(ACCOUNTS_DIR)) mkdirSync(ACCOUNTS_DIR, { recursive: true });
}

function findChrome(): string | null {
  for (const p of CHROME_PATHS) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

function getAccountPath(accountId: string): string {
  return join(ACCOUNTS_DIR, `veo3-${accountId}.json`);
}

function getProfilePath(accountId: string): string {
  return join(PROFILES_DIR, `veo3-${accountId}`);
}

async function loadAccount(accountId: string): Promise<any | null> {
  const path = getAccountPath(accountId);
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
  } catch {
    return null;
  }
}

async function saveAccount(accountId: string, data: any) {
  ensureDirs();
  const path = getAccountPath(accountId);
  try {
    const { encryptObject } = await import("../../test/cookie-capture/crypto");
    const encryptedData = {
      _encrypted: true,
      _version: 1,
      data: encryptObject(data),
    };
    await Bun.write(path, JSON.stringify(encryptedData, null, 2));
  } catch {
    await Bun.write(path, JSON.stringify(data, null, 2));
  }
}

async function findGpmApiUrl(): Promise<string | null> {
  for (let retry = 0; retry < 5; retry++) {
    for (const port of GPM_PORT_RANGE) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v3/profiles`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          console.error(`[GPM] Found at port ${port}`);
          return `http://127.0.0.1:${port}/api/v3`;
        }
      } catch {}
    }
    if (retry < 4) {
      console.error(`[GPM] Retry ${retry + 1}/5...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

function parseCookies(cookieString: string) {
  const cookies: any[] = [];
  const pairs = cookieString.split("; ");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.substring(0, idx).trim();
    const value = pair.substring(idx + 1);
    if (!name || !value) continue;
    const isSecure = name.startsWith("__Secure-") || name.startsWith("__Host-");
    cookies.push({
      name,
      value,
      domain: name.startsWith("__Host-") ? "labs.google" : ".labs.google",
      path: "/",
      secure: isSecure,
      httpOnly: true,
      sameSite: "Lax" as const,
    });
  }
  return cookies;
}

async function listAccounts() {
  ensureDirs();
  const accounts: string[] = [];

  if (existsSync(ACCOUNTS_DIR)) {
    const files = readdirSync(ACCOUNTS_DIR);
    for (const f of files) {
      if (f.startsWith("veo3-") && f.endsWith(".json")) {
        accounts.push(f.replace("veo3-", "").replace(".json", ""));
      }
    }
  }

  console.log(JSON.stringify({ success: true, accounts }));
}

async function getAccountInfo(accountId: string) {
  const data = await loadAccount(accountId);
  if (!data) {
    console.log(JSON.stringify({ success: false, message: "Account not found" }));
    return;
  }

  let email = data.email || "";
  const credits = data.credits?.videosRemaining ?? data.credits ?? null;
  const cookies = data.http?.cookies || {};
  let cookieExpiry = data.cookieExpiry || null;
  let expiresIn: string | null = null;
  let isExpired = false;

  if (!email && cookies.EMAIL) {
    email = decodeURIComponent(cookies.EMAIL).replace(/^"|"$/g, "");
  }

  if (!cookieExpiry && data.http?.headers?.Cookie) {
    try {
      const res = await fetch("https://labs.google/fx/api/auth/session", {
        headers: {
          Cookie: data.http.headers.Cookie,
          Accept: "application/json",
        },
      });
      const session = (await res.json()) as any;
      if (session?.expires) {
        cookieExpiry = session.expires;
        data.cookieExpiry = cookieExpiry;
        await saveAccount(accountId, data);
      }
    } catch {}
  }

  if (cookieExpiry) {
    const expiryDate = new Date(cookieExpiry);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      isExpired = true;
      expiresIn = "Het han";
    } else {
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (diffDays > 0) {
        expiresIn = `${diffDays}d ${diffHours}h`;
      } else {
        expiresIn = `${diffHours}h`;
      }
    }
  }

  console.log(
    JSON.stringify({
      success: true,
      email,
      credits,
      hasCookies: Object.keys(cookies).length > 0,
      hasAuth: !!data.http?.headers?.Authorization,
      cookieExpiry,
      expiresIn,
      isExpired,
    })
  );
}

async function openLogin(accountId: string) {
  ensureDirs();
  const chromePath = findChrome();
  if (!chromePath) {
    console.log(JSON.stringify({ success: false, message: "Chrome not found" }));
    return;
  }

  const profilePath = getProfilePath(accountId);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    userDataDir: profilePath,
    defaultViewport: null,
    args: [
      "--start-maximized",
      "--remote-debugging-port=9222",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-first-run",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  const client = await page.createCDPSession();
  await client.send("Network.enable");

  let captured = false;
  let capturedCredits: number | undefined;
  const pendingRequests = new Map<string, string>();

  client.on("Network.requestWillBeSent", async (params: any) => {
    const url = params.request.url;
    if (!url.includes("labs.google") && !url.includes("aisandbox-pa.googleapis.com")) return;

    if (url.includes("aisandbox-pa.googleapis.com")) {
      pendingRequests.set(params.requestId, url);
    }

    const headers = params.request.headers;
    const authorization = headers["Authorization"] || headers["authorization"] || "";
    
    // Capture khi có session cookie, không cần đợi Authorization
    if (captured) return;

    try {
      const pageCookies = await page.cookies();
      const sessionCookie = pageCookies.find((c) => c.name === "__Secure-next-auth.session-token");
      if (!sessionCookie) return;

      // Đã có session cookie -> capture
      captured = true;
      const cookieHeader = pageCookies.map((c) => `${c.name}=${c.value}`).join("; ");
      const cookies: Record<string, string> = {};
      for (const c of pageCookies) {
        cookies[c.name] = c.value;
      }

      let email = "";
      if (cookies["EMAIL"]) {
        email = decodeURIComponent(cookies["EMAIL"]).replace(/^"|"$/g, "");
      }

      let cookieExpiry: string | null = null;
      let freshAuthToken: string | null = null;
      
      try {
        const sessionRes = await page.evaluate(async () => {
          const res = await fetch("https://labs.google/fx/api/auth/session", {
            credentials: "include",
          });
          return await res.json();
        });

        if (sessionRes?.expires) {
          cookieExpiry = sessionRes.expires;
          console.error(`Session expires: ${cookieExpiry}`);
        }
        if (sessionRes?.accessToken) {
          freshAuthToken = sessionRes.accessToken;
          console.error(`Got fresh auth token from session API`);
        }
      } catch {
        if (sessionCookie.expires && sessionCookie.expires > 0) {
          cookieExpiry = new Date(sessionCookie.expires * 1000).toISOString();
        }
      }

      // Dùng auth token từ session API hoặc từ request header
      const finalAuth = freshAuthToken ? `Bearer ${freshAuthToken}` : (authorization || "");

      const accountData: any = {
        http: {
          timestamp: new Date().toISOString(),
          headers: { Authorization: finalAuth, Cookie: cookieHeader },
          cookies,
        },
        email,
        cookieExpiry,
      };

      if (capturedCredits !== undefined) {
        accountData.credits = { videosRemaining: capturedCredits, updatedAt: new Date().toISOString() };
      }

      await saveAccount(accountId, accountData);
      console.log(JSON.stringify({ success: true, message: "Captured!", email, credits: capturedCredits, cookieExpiry }));
    } catch (e: any) {
      console.log(JSON.stringify({ success: false, message: e.message }));
    }
  });

  client.on("Network.responseReceived", async (params: any) => {
    if (!pendingRequests.has(params.requestId)) return;
    pendingRequests.delete(params.requestId);

    try {
      const response = await client.send("Network.getResponseBody", { requestId: params.requestId });
      const data = JSON.parse(response.body);

      let credits = data.remainingCredits ?? data.credits ?? data.remaining ?? data.balance;

      if (credits === undefined && typeof data === "object") {
        const jsonStr = JSON.stringify(data);
        const match = jsonStr.match(/"(?:remainingCredits|credits|remaining|balance)":\s*(\d+)/i);
        if (match) credits = parseInt(match[1]);
      }

      if (credits !== undefined) {
        console.error(`VEO3 Credits: ${credits}`);
        capturedCredits = credits;

        const existingData = await loadAccount(accountId);
        if (existingData) {
          existingData.credits = { videosRemaining: credits, updatedAt: new Date().toISOString() };
          await saveAccount(accountId, existingData);
        }
      }
    } catch {}
  });

  browser.on("disconnected", () => {
    if (!captured) {
      console.log(JSON.stringify({ success: false, message: "Browser closed without capture" }));
    }
    process.exit(0);
  });

  await page.goto("https://labs.google/fx/tools/flow", { waitUntil: "networkidle2" });

  // Nếu chưa capture từ network request, thử capture sau khi page load
  if (!captured) {
    console.error("[Login] Page loaded, checking for existing session...");
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const pageCookies = await page.cookies();
      const sessionCookie = pageCookies.find((c) => c.name === "__Secure-next-auth.session-token");

      if (sessionCookie) {
        console.error("[Login] Found session cookie, capturing...");
        const cookieHeader = pageCookies.map((c) => `${c.name}=${c.value}`).join("; ");
        const cookies: Record<string, string> = {};
        for (const c of pageCookies) {
          cookies[c.name] = c.value;
        }

        let email = "";
        if (cookies["EMAIL"]) {
          email = decodeURIComponent(cookies["EMAIL"]).replace(/^"|"$/g, "");
        }

        let cookieExpiry: string | null = null;
        let freshAuthToken: string | null = null;

        try {
          const sessionRes = await page.evaluate(async () => {
            const res = await fetch("https://labs.google/fx/api/auth/session", {
              credentials: "include",
            });
            return await res.json();
          });

          if (sessionRes?.expires) {
            cookieExpiry = sessionRes.expires;
            console.error(`[Login] Session expires: ${cookieExpiry}`);
          }
          if (sessionRes?.accessToken) {
            freshAuthToken = sessionRes.accessToken;
            console.error(`[Login] Got fresh auth token`);
          }
        } catch (e: any) {
          console.error(`[Login] Session API error: ${e.message}`);
          if (sessionCookie.expires && sessionCookie.expires > 0) {
            cookieExpiry = new Date(sessionCookie.expires * 1000).toISOString();
          }
        }

        const accountData: any = {
          http: {
            timestamp: new Date().toISOString(),
            headers: {
              Authorization: freshAuthToken ? `Bearer ${freshAuthToken}` : "",
              Cookie: cookieHeader,
            },
            cookies,
          },
          email,
          cookieExpiry,
        };

        await saveAccount(accountId, accountData);
        captured = true;
        console.log(
          JSON.stringify({ success: true, message: "Captured!", email, cookieExpiry })
        );
      } else {
        console.error("[Login] No session cookie found - user needs to login");
      }
    } catch (e: any) {
      console.error(`[Login] Capture error: ${e.message}`);
    }
  }
}


async function getTokens(accountId: string) {
  let gpmApiUrl: string | null = null;
  let profileId: string | null = null;
  let browser: any = null;

  try {
    const accountData = await loadAccount(accountId);
    if (!accountData?.http?.headers?.Cookie) {
      console.log(JSON.stringify({ success: false, message: "No cookies found for account" }));
      return;
    }

    const cookie = accountData.http.headers.Cookie;
    const email = accountData.email || accountId;

    console.error(`[GPM] Finding GPM API...`);
    gpmApiUrl = await findGpmApiUrl();
    if (!gpmApiUrl) {
      console.log(JSON.stringify({ success: false, message: "GPM not running. Please start GPM-Login first." }));
      return;
    }

    console.error(`[GPM] Creating profile for ${email}...`);
    const profileName = `veo3_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const createRes = await fetch(`${gpmApiUrl}/profiles/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_name: profileName,
        group_name: "veo3",
        browser_core: "chromium",
        browser_name: "Chrome",
        is_noise_canvas: true,
        is_noise_webgl: true,
        is_noise_audio_context: true,
      }),
    });
    const createData = (await createRes.json()) as any;
    if (!createData.success) {
      throw new Error(`Failed to create GPM profile: ${JSON.stringify(createData)}`);
    }
    profileId = createData.data.id;
    console.error(`[GPM] Profile created: ${profileId}`);

    console.error(`[GPM] Starting profile...`);
    const openRes = await fetch(`${gpmApiUrl}/profiles/start/${profileId}?win_size=400,400`);
    const openData = (await openRes.json()) as any;
    if (!openData.success) {
      throw new Error(`Failed to start GPM profile: ${JSON.stringify(openData)}`);
    }
    const debugAddress = openData.data.remote_debugging_address;
    console.error(`[GPM] Profile started: ${debugAddress}`);

    console.error(`[GPM] Connecting to browser...`);
    for (let i = 0; i < CONNECT_RETRY_COUNT; i++) {
      try {
        await new Promise((r) => setTimeout(r, CONNECT_RETRY_DELAY));
        browser = await puppeteer.connect({
          browserURL: `http://${debugAddress}`,
          defaultViewport: null,
          protocolTimeout: 60000,
        });
        console.error(`[GPM] Connected to browser`);
        break;
      } catch (e: any) {
        console.error(`[GPM] Connect attempt ${i + 1}/${CONNECT_RETRY_COUNT} failed: ${e.message}`);
        if (i === CONNECT_RETRY_COUNT - 1) throw e;
      }
    }

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    const client = await page.createCDPSession();
    await client.send("Network.enable");

    let authToken: string | null = null;

    client.on("Network.requestWillBeSent", (params: any) => {
      const auth = params.request.headers["Authorization"] || params.request.headers["authorization"];
      if (auth?.startsWith("Bearer ya29.") && !authToken) {
        authToken = auth.replace("Bearer ", "");
        console.error(`[GPM] Captured auth token from network: ${authToken?.substring(0, 30)}...`);
      }
    });

    console.error(`[GPM] Navigating to labs.google first...`);
    await page.goto("https://labs.google", { waitUntil: "domcontentloaded", timeout: 30000 });

    console.error(`[GPM] Setting cookies...`);
    await page.setCookie(...parseCookies(cookie));

    console.error(`[GPM] Navigating to flow page...`);
    await page.goto("https://labs.google/fx/tools/flow", { waitUntil: "networkidle2", timeout: 60000 });

    console.error(`[GPM] Waiting for page to load...`);
    await new Promise((r) => setTimeout(r, 5000));

    const hasRecaptcha = await page.evaluate(() => !!(window as any).grecaptcha?.enterprise);
    if (!hasRecaptcha) {
      throw new Error("Cookie expired - reCAPTCHA not loaded");
    }
    console.error(`[GPM] reCAPTCHA ready`);

    console.error(`[GPM] Getting reCAPTCHA token...`);
    const recaptchaToken = await page.evaluate(async (siteKey: string) => {
      return await (window as any).grecaptcha.enterprise.execute(siteKey, {
        action: "VIDEO_GENERATION",
      });
    }, SITE_KEY);

    if (!recaptchaToken) {
      throw new Error("Failed to get reCAPTCHA token");
    }
    console.error(`[GPM] Got reCAPTCHA token: ${recaptchaToken.substring(0, 30)}...`);

    if (!authToken) {
      console.error(`[GPM] Getting auth token via TRPC...`);
      try {
        await page.evaluate(async () => {
          const res = await fetch("https://labs.google/fx/api/trpc/user.getUser?batch=1&input=%7B%220%22%3A%7B%7D%7D", {
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          return await res.json();
        });
        console.error(`[GPM] TRPC response received`);
      } catch (e: any) {
        console.error(`[GPM] TRPC call failed: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!authToken) {
      console.error(`[GPM] Triggering video generation API to capture token...`);
      await page.evaluate(async (siteKey: string) => {
        const token = await (window as any).grecaptcha.enterprise.execute(siteKey, { action: "VIDEO_GENERATION" });
        try {
          await fetch("https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText", {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
            body: JSON.stringify({
              clientContext: {
                recaptchaContext: { token, applicationType: "RECAPTCHA_APPLICATION_TYPE_WEB" },
                sessionId: `;${Date.now()}`,
                tool: "PINHOLE",
                userPaygateTier: "PAYGATE_TIER_TWO"
              },
              requests: []
            }),
            credentials: "include"
          });
        } catch {}
      }, SITE_KEY);
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (!authToken) {
      console.error(`[GPM] Reloading page to capture auth...`);
      await page.reload({ waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 5000));
    }

    if (!authToken) {
      console.error(`[GPM] Trying to get token from __NEXT_DATA__...`);
      const nextData = await page.evaluate(() => {
        const el = document.getElementById("__NEXT_DATA__");
        if (el) {
          try {
            return JSON.parse(el.textContent || "{}");
          } catch { return null; }
        }
        return null;
      });

      if (nextData?.props?.pageProps?.session?.accessToken) {
        authToken = nextData.props.pageProps.session.accessToken;
        console.error(`[GPM] Got auth token from __NEXT_DATA__: ${authToken!.substring(0, 30)}...`);
      }
    }

    if (!authToken) {
      console.error(`[GPM] Trying to get token from session API...`);
      const swToken = await page.evaluate(async () => {
        try {
          const res = await fetch("https://labs.google/fx/api/auth/session", { credentials: "include" });
          const data = await res.json();
          return data?.accessToken || null;
        } catch { return null; }
      });

      if (swToken) {
        authToken = swToken;
        console.error(`[GPM] Got auth token from session API: ${authToken!.substring(0, 30)}...`);
      }
    }

    if (!authToken) {
      throw new Error("Failed to capture auth token - try re-login to refresh session");
    }

    try {
      const sessionInfo = await page.evaluate(async () => {
        const res = await fetch("https://labs.google/fx/api/auth/session", { credentials: "include" });
        return await res.json();
      });

      if (sessionInfo?.expires) {
        accountData.cookieExpiry = sessionInfo.expires;
        await saveAccount(accountId, accountData);
        console.error(`[GPM] Session expires: ${sessionInfo.expires}`);
      }
    } catch {}

    console.error(`[GPM] Cleaning up...`);
    browser.disconnect();
    await fetch(`${gpmApiUrl}/profiles/close/${profileId}`);
    await fetch(`${gpmApiUrl}/profiles/delete/${profileId}?mode=2`);
    console.error(`[GPM] Profile deleted`);

    console.log(
      JSON.stringify({
        success: true,
        auth_token: authToken,
        recaptcha_token: recaptchaToken,
      })
    );
  } catch (e: any) {
    console.error(`[GPM] Error: ${e.message}`);

    if (browser) {
      try { browser.disconnect(); } catch {}
    }
    if (gpmApiUrl && profileId) {
      try {
        await fetch(`${gpmApiUrl}/profiles/close/${profileId}`);
        await fetch(`${gpmApiUrl}/profiles/delete/${profileId}?mode=2`);
      } catch {}
    }

    console.log(JSON.stringify({ success: false, message: e.message }));
  }
}

async function getAuthToken(accountId: string) {
  const data = await loadAccount(accountId);
  if (!data?.http?.headers?.Cookie) {
    console.log(JSON.stringify({ success: false, message: "No cookies found - need to login first" }));
    return;
  }

  // Try to get fresh token from session API
  try {
    const res = await fetch("https://labs.google/fx/api/auth/session", {
      headers: {
        Cookie: data.http.headers.Cookie,
        Accept: "application/json",
      },
    });
    const session = (await res.json()) as any;
    const accessToken = session?.accessToken || session?.access_token;
    if (accessToken) {
      // Update saved token
      data.http.headers.Authorization = `Bearer ${accessToken}`;
      await saveAccount(accountId, data);
      console.log(JSON.stringify({ success: true, auth_token: accessToken }));
      return;
    }
  } catch (e: any) {
    console.error(`[Auth] Session API failed: ${e.message}`);
  }

  // Fallback to saved token
  if (!data?.http?.headers?.Authorization) {
    console.log(JSON.stringify({ success: false, message: "No auth token found - need to get-tokens first" }));
    return;
  }
  const authToken = data.http.headers.Authorization.replace("Bearer ", "");
  console.log(JSON.stringify({ success: true, auth_token: authToken }));
}

async function deleteAccount(accountId: string) {
  const accountPath = getAccountPath(accountId);
  const profilePath = getProfilePath(accountId);

  try {
    if (existsSync(accountPath)) {
      const { unlinkSync } = await import("fs");
      unlinkSync(accountPath);
    }

    if (existsSync(profilePath)) {
      const { rmSync } = await import("fs");
      rmSync(profilePath, { recursive: true, force: true });
    }

    console.log(JSON.stringify({ success: true, message: "Account deleted" }));
  } catch (e: any) {
    console.log(JSON.stringify({ success: false, message: e.message }));
  }
}

async function getCookieString(accountId: string) {
  const data = await loadAccount(accountId);
  if (!data?.http?.headers?.Cookie) {
    console.log(JSON.stringify({ success: false, message: "No cookie found" }));
    return;
  }
  console.log(JSON.stringify({ success: true, cookie: data.http.headers.Cookie }));
}

async function getAccountJson(accountId: string) {
  const data = await loadAccount(accountId);
  if (!data) {
    console.log(JSON.stringify({ success: false, message: "Account not found" }));
    return;
  }
  console.log(JSON.stringify({ success: true, json: JSON.stringify(data, null, 2) }));
}

const [action, accountId] = process.argv.slice(2);

// Session storage file để lưu thông tin GPM profile đang mở
const SESSION_FILE = join(DATA_DIR, "active-sessions.json");

interface ActiveSession {
  accountId: string;
  profileId: string;
  gpmApiUrl: string;
  debugAddress: string;
  createdAt: number;
}

async function loadSessions(): Promise<Record<string, ActiveSession>> {
  try {
    if (existsSync(SESSION_FILE)) {
      return await Bun.file(SESSION_FILE).json();
    }
  } catch {}
  return {};
}

async function saveSessions(sessions: Record<string, ActiveSession>) {
  await Bun.write(SESSION_FILE, JSON.stringify(sessions, null, 2));
}

async function initSession(accountId: string) {
  let gpmApiUrl: string | null = null;
  let profileId: string | null = null;
  let browser: any = null;

  try {
    const accountData = await loadAccount(accountId);
    if (!accountData?.http?.headers?.Cookie) {
      console.log(JSON.stringify({ success: false, message: "No cookies found for account" }));
      return;
    }

    const cookie = accountData.http.headers.Cookie;
    const email = accountData.email || accountId;

    // Check if session already exists
    const sessions = await loadSessions();
    if (sessions[accountId]) {
      // Verify session is still valid
      try {
        const statusRes = await fetch(`${sessions[accountId].gpmApiUrl}/profiles/status/${sessions[accountId].profileId}`);
        const statusData = await statusRes.json() as any;
        if (statusData.success && statusData.data?.status === "running") {
          console.error(`[GPM] Reusing existing session for ${email}`);
          console.log(JSON.stringify({ 
            success: true, 
            profileId: sessions[accountId].profileId,
            debugAddress: sessions[accountId].debugAddress,
            reused: true
          }));
          return;
        }
      } catch {}
      // Session invalid, remove it
      delete sessions[accountId];
      await saveSessions(sessions);
    }

    console.error(`[GPM] Finding GPM API...`);
    gpmApiUrl = await findGpmApiUrl();
    if (!gpmApiUrl) {
      console.log(JSON.stringify({ success: false, message: "GPM not running" }));
      return;
    }

    console.error(`[GPM] Creating profile for ${email}...`);
    const profileName = `veo3_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const createRes = await fetch(`${gpmApiUrl}/profiles/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_name: profileName,
        group_name: "veo3",
        browser_core: "chromium",
        browser_name: "Chrome",
        is_noise_canvas: true,
        is_noise_webgl: true,
        is_noise_audio_context: true,
      }),
    });
    const createData = (await createRes.json()) as any;
    if (!createData.success) {
      throw new Error(`Failed to create GPM profile: ${JSON.stringify(createData)}`);
    }
    profileId = createData.data.id;
    console.error(`[GPM] Profile created: ${profileId}`);

    console.error(`[GPM] Starting profile...`);
    const openRes = await fetch(`${gpmApiUrl}/profiles/start/${profileId}?win_size=400,400`);
    const openData = (await openRes.json()) as any;
    if (!openData.success) {
      throw new Error(`Failed to start GPM profile`);
    }
    const debugAddress = openData.data.remote_debugging_address;
    console.error(`[GPM] Profile started: ${debugAddress}`);

    // Connect and setup
    console.error(`[GPM] Connecting to browser...`);
    for (let i = 0; i < CONNECT_RETRY_COUNT; i++) {
      try {
        await new Promise((r) => setTimeout(r, CONNECT_RETRY_DELAY));
        browser = await puppeteer.connect({
          browserURL: `http://${debugAddress}`,
          defaultViewport: null,
          protocolTimeout: 60000,
        });
        console.error(`[GPM] Connected to browser`);
        break;
      } catch (e: any) {
        console.error(`[GPM] Connect attempt ${i + 1}/${CONNECT_RETRY_COUNT} failed: ${e.message}`);
        if (i === CONNECT_RETRY_COUNT - 1) throw e;
      }
    }

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    console.error(`[GPM] Navigating to labs.google first...`);
    await page.goto("https://labs.google", { waitUntil: "domcontentloaded", timeout: 30000 });

    console.error(`[GPM] Setting cookies...`);
    await page.setCookie(...parseCookies(cookie));

    console.error(`[GPM] Navigating to flow page...`);
    await page.goto("https://labs.google/fx/tools/flow", { waitUntil: "networkidle2", timeout: 60000 });

    console.error(`[GPM] Waiting for page to load...`);
    await new Promise((r) => setTimeout(r, 5000));

    const hasRecaptcha = await page.evaluate(() => !!(window as any).grecaptcha?.enterprise);
    if (!hasRecaptcha) {
      throw new Error("Cookie expired - reCAPTCHA not loaded");
    }
    console.error(`[GPM] reCAPTCHA ready`);

    // Disconnect but keep profile running
    browser.disconnect();

    // Save session
    sessions[accountId] = {
      accountId,
      profileId: profileId!,
      gpmApiUrl,
      debugAddress,
      createdAt: Date.now()
    };
    await saveSessions(sessions);

    console.log(JSON.stringify({ 
      success: true, 
      profileId,
      debugAddress,
      reused: false
    }));
  } catch (e: any) {
    console.error(`[GPM] Error: ${e.message}`);
    if (browser) {
      try { browser.disconnect(); } catch {}
    }
    if (gpmApiUrl && profileId) {
      try {
        await fetch(`${gpmApiUrl}/profiles/close/${profileId}`);
        await fetch(`${gpmApiUrl}/profiles/delete/${profileId}?mode=2`);
      } catch {}
    }
    console.log(JSON.stringify({ success: false, message: e.message }));
  }
}

async function getRecaptchaFromSession(accountId: string) {
  let browser: any = null;
  
  try {
    const sessions = await loadSessions();
    const session = sessions[accountId];
    
    if (!session) {
      console.log(JSON.stringify({ success: false, message: "No active session - call init-session first" }));
      return;
    }

    // Connect to existing profile
    console.error(`[GPM] Connecting to existing session...`);
    browser = await puppeteer.connect({
      browserURL: `http://${session.debugAddress}`,
      defaultViewport: null,
      protocolTimeout: 60000,
    });

    const pages = await browser.pages();
    const page = pages[0];
    if (!page) {
      throw new Error("No page found in session");
    }

    // Get auth token from session API
    let authToken: string | null = null;
    try {
      const sessionData = await page.evaluate(async () => {
        const res = await fetch("https://labs.google/fx/api/auth/session", { credentials: "include" });
        return await res.json();
      });
      authToken = sessionData?.accessToken || sessionData?.access_token;
    } catch {}

    if (!authToken) {
      // Try from __NEXT_DATA__
      const nextData = await page.evaluate(() => {
        const el = document.getElementById("__NEXT_DATA__");
        if (el) {
          try { return JSON.parse(el.textContent || "{}"); } catch { return null; }
        }
        return null;
      });
      authToken = nextData?.props?.pageProps?.session?.accessToken;
    }

    if (!authToken) {
      throw new Error("Failed to get auth token from session");
    }

    // Get reCAPTCHA token
    const hasRecaptcha = await page.evaluate(() => !!(window as any).grecaptcha?.enterprise);
    if (!hasRecaptcha) {
      throw new Error("reCAPTCHA not available - session may be expired");
    }

    const recaptchaToken = await page.evaluate(async (siteKey: string) => {
      return await (window as any).grecaptcha.enterprise.execute(siteKey, {
        action: "VIDEO_GENERATION",
      });
    }, SITE_KEY);

    if (!recaptchaToken) {
      throw new Error("Failed to get reCAPTCHA token");
    }

    browser.disconnect();

    console.log(JSON.stringify({
      success: true,
      auth_token: authToken,
      recaptcha_token: recaptchaToken,
    }));
  } catch (e: any) {
    console.error(`[GPM] Error: ${e.message}`);
    if (browser) {
      try { browser.disconnect(); } catch {}
    }
    
    // If session failed, remove it
    const sessions = await loadSessions();
    if (sessions[accountId]) {
      try {
        await fetch(`${sessions[accountId].gpmApiUrl}/profiles/close/${sessions[accountId].profileId}`);
        await fetch(`${sessions[accountId].gpmApiUrl}/profiles/delete/${sessions[accountId].profileId}?mode=2`);
      } catch {}
      delete sessions[accountId];
      await saveSessions(sessions);
    }
    
    console.log(JSON.stringify({ success: false, message: e.message }));
  }
}

async function closeSession(accountId: string) {
  try {
    const sessions = await loadSessions();
    const session = sessions[accountId];
    
    if (!session) {
      console.log(JSON.stringify({ success: true, message: "No active session" }));
      return;
    }

    try {
      await fetch(`${session.gpmApiUrl}/profiles/close/${session.profileId}`);
      await fetch(`${session.gpmApiUrl}/profiles/delete/${session.profileId}?mode=2`);
    } catch {}

    delete sessions[accountId];
    await saveSessions(sessions);

    console.log(JSON.stringify({ success: true, message: "Session closed" }));
  } catch (e: any) {
    console.log(JSON.stringify({ success: false, message: e.message }));
  }
}

async function closeAllSessions() {
  try {
    const sessions = await loadSessions();
    
    for (const [accountId, session] of Object.entries(sessions)) {
      try {
        await fetch(`${session.gpmApiUrl}/profiles/close/${session.profileId}`);
        await fetch(`${session.gpmApiUrl}/profiles/delete/${session.profileId}?mode=2`);
        console.error(`[GPM] Closed session for ${accountId}`);
      } catch {}
    }

    await saveSessions({});
    console.log(JSON.stringify({ success: true, message: "All sessions closed" }));
  } catch (e: any) {
    console.log(JSON.stringify({ success: false, message: e.message }));
  }
}

async function main() {
  try {
    switch (action) {
      case "list":
        await listAccounts();
        break;
      case "info":
        await getAccountInfo(accountId);
        break;
      case "open-login":
        await openLogin(accountId || `acc-${Date.now()}`);
        break;
      case "get-tokens":
        await getTokens(accountId);
        break;
      case "get-auth-token":
        await getAuthToken(accountId);
        break;
      case "init-session":
        await initSession(accountId);
        break;
      case "get-recaptcha":
        await getRecaptchaFromSession(accountId);
        break;
      case "close-session":
        await closeSession(accountId);
        break;
      case "close-all-sessions":
        await closeAllSessions();
        break;
      case "delete":
        await deleteAccount(accountId);
        break;
      case "get-cookie":
        await getCookieString(accountId);
        break;
      case "get-json":
        await getAccountJson(accountId);
        break;
      default:
        console.log(JSON.stringify({ success: false, message: `Unknown action: ${action}` }));
    }
  } catch (e: any) {
    console.log(JSON.stringify({ success: false, message: e.message }));
  }
}

main();
