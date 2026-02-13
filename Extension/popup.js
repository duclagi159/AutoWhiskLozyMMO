const WHISK_URL = 'https://labs.google/fx/vi/tools/whisk/project';

document.addEventListener('DOMContentLoaded', () => {
    const btnCopy = document.getElementById('btnCopy');
    const btnGrab = document.getElementById('btnGrab');
    const btnOpen = document.getElementById('btnOpen');
    const btnClear = document.getElementById('btnClear');

    loadStatus();

    btnOpen.addEventListener('click', () => {
        chrome.tabs.create({ url: WHISK_URL });
        window.close();
    });

    btnGrab.addEventListener('click', () => {
        btnGrab.disabled = true;
        btnGrab.textContent = '⏳ Đang lấy...';

        chrome.runtime.sendMessage({ type: 'GRAB_ALL' }, (data) => {
            btnGrab.disabled = false;
            btnGrab.textContent = '🔄 Lấy Cookie';

            if (data?.error) {
                showMsg('error', `❌ ${data.error}`);
                return;
            }

            if (!data?.sessionToken) {
                showMsg('error', '❌ Không tìm thấy cookie! Đăng nhập labs.google trước.');
                return;
            }

            loadStatus();
            showMsg('success', data.email ? '✅ Cookie + Gmail OK!' : '✅ Cookie OK!');
        });
    });

    btnCopy.addEventListener('click', async () => {
        chrome.runtime.sendMessage({ type: 'GET_DATA' }, async (data) => {
            if (!data?.sessionToken) {
                showMsg('error', '❌ Chưa có cookie! Bấm "Lấy Cookie" trước.');
                return;
            }

            const exportData = JSON.stringify({
                id: `acc-${Date.now()}`,
                email: data.email || 'Unknown',
                cookies: data.cookies || '',
                savedAt: new Date().toISOString()
            });

            await navigator.clipboard.writeText(exportData);
            showMsg('success', '✅ Đã copy! Dán vào AutoWhisk → Thêm');
        });
    });

    btnClear.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'CLEAR' }, () => {
            loadStatus();
            showMsg('success', '🗑️ Đã xóa!');
        });
    });

    function loadStatus() {
        chrome.runtime.sendMessage({ type: 'GET_DATA' }, (data) => {
            const emailDisplayEl = document.getElementById('emailDisplay');
            const emailAvatarEl = document.getElementById('emailAvatar');
            const cookieStatusEl = document.getElementById('cookieStatus');
            const tokenStatusEl = document.getElementById('tokenStatus');
            const headersStatusEl = document.getElementById('headersStatus');
            const capturedAtEl = document.getElementById('capturedAt');

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

                tokenStatusEl.innerHTML = '<span class="token-badge ok">✅ Tự động</span>';

                if (headersStatusEl) {
                    headersStatusEl.textContent = 'Tự động';
                    headersStatusEl.className = 'status-value ok';
                }

                if (data.capturedAt) {
                    capturedAtEl.textContent = new Date(data.capturedAt).toLocaleTimeString('vi-VN', { hour12: false });
                    capturedAtEl.className = 'status-value ok';
                }
            } else {
                cookieStatusEl.innerHTML = '<span class="token-badge no">❌ Chưa có</span>';
                tokenStatusEl.innerHTML = '<span class="token-badge no">⏳ Cần cookie</span>';
                if (headersStatusEl) {
                    headersStatusEl.textContent = '0';
                    headersStatusEl.className = 'status-value no';
                }
                capturedAtEl.textContent = '--';
                capturedAtEl.className = 'status-value no';
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
