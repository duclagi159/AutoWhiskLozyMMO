const STORAGE_KEY = 'autowhisk_data';

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        const headers = {};
        let bearerToken = '';

        for (const header of details.requestHeaders || []) {
            const name = header.name.toLowerCase();
            if (name === 'authorization' && header.value?.startsWith('Bearer ')) {
                bearerToken = header.value.replace('Bearer ', '');
            }
            if (name === 'x-browser-channel') headers['x-browser-channel'] = header.value;
            if (name === 'x-browser-copyright') headers['x-browser-copyright'] = header.value;
            if (name === 'x-browser-validation') headers['x-browser-validation'] = header.value;
            if (name === 'x-browser-year') headers['x-browser-year'] = header.value;
            if (name === 'x-client-data') headers['x-client-data'] = header.value;
        }

        if (bearerToken) {
            chrome.storage.local.get(STORAGE_KEY, (result) => {
                const existing = result[STORAGE_KEY] || {};
                existing.bearerToken = bearerToken;
                existing.headers = headers;
                existing.tokenCapturedAt = new Date().toISOString();
                chrome.storage.local.set({ [STORAGE_KEY]: existing });
                chrome.action.setBadgeText({ text: '✓' });
                chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
            });
        }
    },
    {
        urls: [
            'https://aisandbox-pa.googleapis.com/*',
            'https://labs.google/fx/api/*'
        ]
    },
    ['requestHeaders']
);

async function getSessionCookie() {
    const cookie = await chrome.cookies.get({
        url: 'https://labs.google',
        name: '__Secure-next-auth.session-token'
    });
    return cookie?.value || '';
}

async function extractEmailFromPage(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const selectors = 'a[aria-label*="@"], button[aria-label*="@"], img[aria-label*="@"], [data-identifier*="@"], [data-email]';
                for (const el of document.querySelectorAll(selectors)) {
                    const val = el.getAttribute('aria-label') || el.getAttribute('data-identifier') || el.getAttribute('data-email') || '';
                    const m = val.match(/[\w.\-+]+@[\w.\-]+\.\w+/);
                    if (m) return m[0];
                }

                for (const cls of ['.gb_lb', '.gb_kb', '.gb_db', '.gb_Ab']) {
                    const el = document.querySelector(cls);
                    if (el) {
                        const m = el.textContent.match(/[\w.\-+]+@[\w.\-]+\.\w+/);
                        if (m) return m[0];
                    }
                }

                for (const s of document.querySelectorAll('script')) {
                    const m = (s.textContent || '').match(/"([\w.\-+]+@(?:gmail|googlemail)\.com)"/);
                    if (m) return m[1];
                }

                const nd = document.getElementById('__NEXT_DATA__');
                if (nd) {
                    const m = nd.textContent.match(/"([\w.\-+]+@[\w.\-]+\.\w+)"/);
                    if (m) return m[1];
                }

                const bodyMatch = document.documentElement.innerHTML.match(/[\w.\-+]+@gmail\.com/);
                return bodyMatch ? bodyMatch[0] : null;
            }
        });
        return results?.[0]?.result || null;
    } catch {
        return null;
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GRAB_ALL') {
        (async () => {
            try {
                const sessionToken = await getSessionCookie();

                if (!sessionToken) {
                    sendResponse({ error: 'Không tìm thấy cookie! Hãy đăng nhập labs.google trước.' });
                    return;
                }

                const stored = await chrome.storage.local.get(STORAGE_KEY);
                const existing = stored[STORAGE_KEY] || {};

                let email = '';
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.url?.includes('labs.google')) {
                    email = await extractEmailFromPage(tab.id) || '';
                }

                const data = {
                    sessionToken,
                    cookies: `__Secure-next-auth.session-token=${sessionToken}`,
                    email,
                    bearerToken: existing.bearerToken || '',
                    headers: existing.headers || {},
                    capturedAt: new Date().toISOString(),
                    tokenCapturedAt: existing.tokenCapturedAt || null
                };

                await chrome.storage.local.set({ [STORAGE_KEY]: data });

                if (data.bearerToken) {
                    chrome.action.setBadgeText({ text: '✓' });
                    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
                } else {
                    chrome.action.setBadgeText({ text: '½' });
                    chrome.action.setBadgeBackgroundColor({ color: '#eab308' });
                }

                sendResponse(data);
            } catch (err) {
                sendResponse({ error: err.message });
            }
        })();
        return true;

    } else if (msg.type === 'GET_DATA') {
        chrome.storage.local.get(STORAGE_KEY).then(result => {
            sendResponse(result[STORAGE_KEY] || null);
        });
        return true;

    } else if (msg.type === 'CLEAR') {
        chrome.storage.local.remove(STORAGE_KEY);
        chrome.action.setBadgeText({ text: '' });
        sendResponse({ ok: true });
    }

    return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('labs.google/fx')) {
        (async () => {
            const sessionToken = await getSessionCookie();
            if (!sessionToken) return;

            const stored = await chrome.storage.local.get(STORAGE_KEY);
            const existing = stored[STORAGE_KEY] || {};

            existing.sessionToken = sessionToken;
            existing.cookies = `__Secure-next-auth.session-token=${sessionToken}`;
            existing.capturedAt = new Date().toISOString();

            const email = await extractEmailFromPage(tabId);
            if (email) existing.email = email;

            await chrome.storage.local.set({ [STORAGE_KEY]: existing });
        })();
    }
});
