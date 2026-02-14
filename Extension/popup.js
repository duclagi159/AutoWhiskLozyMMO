const WHISK_URL = 'https://labs.google/fx/vi/tools/whisk/project';

document.addEventListener('DOMContentLoaded', () => {
    const btnCopy = document.getElementById('btnCopy');
    const btnOpen = document.getElementById('btnOpen');
    const btnClear = document.getElementById('btnClear');

    function grabCookies() {
        chrome.runtime.sendMessage({ type: 'GRAB_ALL' }, (data) => {
            if (data?.error || !data?.sessionToken) return loadStatus();
            loadStatus();
        });
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url?.includes('labs.google')) {
            grabCookies();
        } else {
            loadStatus();
        }
    });

    btnOpen.addEventListener('click', () => {
        chrome.tabs.create({ url: WHISK_URL });
        window.close();
    });

    btnCopy.addEventListener('click', async () => {
        chrome.runtime.sendMessage({ type: 'GET_DATA' }, async (data) => {
            if (!data?.sessionToken) {
                showMsg('error', '❌ Chưa có cookie! Mở Whisk trước.');
                return;
            }

            const exportData = JSON.stringify({
                id: `acc-${Date.now()}`,
                email: data.email || 'Unknown',
                cookies: data.cookies || '',
                savedAt: new Date().toISOString(),
                expiresAt: data.expiresAt || null
            });

            await navigator.clipboard.writeText(exportData);
            showMsg('success', '✅ Đã copy! Dán vào AutoWhisk → Thêm');
        });
    });

    btnClear.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'CLEAR' }, () => {
            loadStatus();

            chrome.tabs.query({ url: 'https://labs.google/*' }, (tabs) => {
                if (tabs.length > 0) {
                    const tabId = tabs[0].id;
                    chrome.tabs.reload(tabId);
                    chrome.tabs.onUpdated.addListener(function listener(tid, info) {
                        if (tid === tabId && info.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(listener);
                            setTimeout(loadStatus, 2000);
                        }
                    });
                }
            });

            showMsg('success', '🗑️ Đã xóa & reload web!');
        });
    });

    function loadStatus() {
        chrome.runtime.sendMessage({ type: 'GET_DATA' }, (data) => {
            const emailDisplayEl = document.getElementById('emailDisplay');
            const emailAvatarEl = document.getElementById('emailAvatar');
            const cookieStatusEl = document.getElementById('cookieStatus');
            const capturedAtEl = document.getElementById('capturedAt');
            const expiresAtEl = document.getElementById('expiresAt');

            if (data?.sessionToken) {
                const tokenShort = data.sessionToken.substring(0, 15) + '...';
                cookieStatusEl.innerHTML = `<span class="token-badge ok">✅ ${tokenShort}</span>`;
                btnCopy.disabled = false;

                if (data.email) {
                    emailDisplayEl.textContent = data.email;
                    emailDisplayEl.className = 'email-value';
                    emailAvatarEl.textContent = data.email.charAt(0).toUpperCase();
                    emailAvatarEl.style.background = 'linear-gradient(135deg, #06b6d4, #8b5cf6)';
                } else {
                    emailDisplayEl.textContent = 'Chưa xác định';
                    emailDisplayEl.className = 'email-value no';
                    emailAvatarEl.textContent = '?';
                    emailAvatarEl.style.background = '#374151';
                }

                if (data.capturedAt) {
                    capturedAtEl.textContent = new Date(data.capturedAt).toLocaleTimeString('vi-VN', { hour12: false });
                    capturedAtEl.className = 'status-value ok';
                }

                if (data.capturedAt) {
                    const expDate = new Date(new Date(data.capturedAt).getTime() + 24 * 60 * 60 * 1000);
                    const now = Date.now();
                    const expired = expDate.getTime() <= now;
                    expiresAtEl.textContent = expDate.toLocaleString('vi-VN', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                    expiresAtEl.className = expired ? 'status-value no' : 'status-value ok';
                } else {
                    expiresAtEl.textContent = '--';
                    expiresAtEl.className = 'status-value no';
                }
            } else {
                cookieStatusEl.innerHTML = '<span class="token-badge no">❌ Chưa có</span>';
                capturedAtEl.textContent = '--';
                capturedAtEl.className = 'status-value no';
                expiresAtEl.textContent = '--';
                expiresAtEl.className = 'status-value no';
                emailDisplayEl.textContent = 'Chưa xác định';
                emailDisplayEl.className = 'email-value no';
                emailAvatarEl.textContent = '?';
                emailAvatarEl.style.background = '#374151';
                btnCopy.disabled = true;
            }
        });
    }
});

function showMsg(type, text) {
    const msg = document.getElementById('msg');
    msg.className = `msg ${type}`;
    msg.textContent = text;
    setTimeout(() => { msg.className = 'msg'; }, 5000);
}
