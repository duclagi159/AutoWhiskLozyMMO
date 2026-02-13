import { useState, useEffect } from 'react';
import { LogEntry } from './AutoWhiskTab';

interface AccountInfo {
  id: string;
  email: string;
  cookies: string;
  bearerToken?: string;
  headers?: Record<string, string>;
  has_cookies: boolean;
  is_expired: boolean;
  expires_in?: string;
  savedAt?: string;
  projectLink?: string;
}

export interface SelectedAccount {
  id: string;
  threads: number;
}

interface Props {
  selectedAccounts: SelectedAccount[];
  onSelectAccounts: (accounts: SelectedAccount[]) => void;
  onLog: (msg: string, type?: LogEntry['type']) => void;
  onAccountsLoaded: (emails: Record<string, string>) => void;
  isRunning?: boolean;
}

const STORAGE_KEY = 'autowhisk_accounts';

function getStoredAccounts(): AccountInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function setStoredAccounts(accounts: AccountInfo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function AccountSection({ selectedAccounts, onSelectAccounts, onLog, onAccountsLoaded, isRunning }: Props) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cookieInput, setCookieInput] = useState('');

  const loadAccounts = () => {
    setLoading(true);
    const list = getStoredAccounts();

    // Check expiry (7 days)
    const now = Date.now();
    const updated = list.map(acc => {
      if (acc.savedAt) {
        const saved = new Date(acc.savedAt).getTime();
        const remaining = (saved + 24 * 60 * 60 * 1000) - now;
        if (remaining <= 0) {
          return { ...acc, is_expired: true, expires_in: 'Hết hạn' };
        } else {
          const hours = Math.floor(remaining / (60 * 60 * 1000));
          const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          return { ...acc, is_expired: false, expires_in: `${hours}h ${minutes}m` };
        }
      }
      return acc;
    });

    setAccounts(updated);
    const emailMap: Record<string, string> = {};
    for (const acc of updated) {
      emailMap[acc.id] = acc.email || acc.id;
    }
    onAccountsLoaded(emailMap);
    setLoading(false);
  };

  const saveAccount = () => {
    if (!cookieInput.trim()) {
      onLog('❌ Hãy dán cookie từ Extension vào!', 'error');
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cookieInput);
    } catch {
      onLog('❌ Dữ liệu không đúng định dạng JSON.', 'error');
      return;
    }

    if (!parsed.cookies) {
      onLog('❌ Không tìm thấy cookie.', 'error');
      return;
    }

    const accountId = parsed.id || `acc-${Date.now()}`;
    const email = parsed.email || 'Unknown';

    // Check duplicate
    const existing = getStoredAccounts();
    const updated = existing.filter(a => a.id !== accountId);
    updated.push({
      id: accountId,
      email,
      cookies: parsed.cookies,
      bearerToken: parsed.bearerToken || '',
      headers: parsed.headers || {},
      has_cookies: true,
      is_expired: false,
      savedAt: parsed.savedAt || new Date().toISOString(),
    });
    setStoredAccounts(updated);

    setShowAddModal(false);
    setCookieInput('');
    loadAccounts();
  };

  const deleteAccount = (id: string) => {
    if (!confirm(`Xóa account ${id}?`)) return;
    const updated = getStoredAccounts().filter(a => a.id !== id);
    setStoredAccounts(updated);
    onLog(`🗑️ Đã xóa account ${id}`, 'info');
    onSelectAccounts(selectedAccounts.filter(a => a.id !== id));
    loadAccounts();
  };

  const toggleAccount = (id: string) => {
    const existing = selectedAccounts.find(a => a.id === id);
    if (existing) {
      onSelectAccounts(selectedAccounts.filter(a => a.id !== id));
    } else {
      onSelectAccounts([...selectedAccounts, { id, threads: 2 }]);
    }
  };

  const updateThreads = (id: string, threads: number) => {
    onSelectAccounts(selectedAccounts.map(a => a.id === id ? { ...a, threads } : a));
  };

  useEffect(() => {
    loadAccounts();
    const handler = () => loadAccounts();
    window.addEventListener('accounts-updated', handler);
    const expiryInterval = setInterval(loadAccounts, 60000);
    const clearLinks = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const accs = JSON.parse(raw);
          const cleaned = accs.map((a: any) => { const { projectLink, ...rest } = a; return rest; });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
        }
      } catch { }
    };
    window.addEventListener('beforeunload', clearLinks);
    return () => {
      window.removeEventListener('accounts-updated', handler);
      window.removeEventListener('beforeunload', clearLinks);
      clearInterval(expiryInterval);
    };
  }, []);

  const totalThreads = selectedAccounts.reduce((sum, a) => sum + a.threads, 0);

  return (
    <>
      <div className="bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 bg-[#1a1a2a] cursor-pointer hover:bg-[#1f1f2f] transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">👤</span>
            <span className="text-sm font-medium text-gray-300">Accounts</span>
            {selectedAccounts.length > 0 && (
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                {selectedAccounts.length} acc × {totalThreads} luồng
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); loadAccounts(); }}
              disabled={loading}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs transition-colors"
            >
              {loading ? '⏳' : '🔄'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddModal(true); }}
              className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-xs font-medium transition-colors"
            >
              ➕ Thêm
            </button>
            <span className="text-gray-500 text-sm ml-2">{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 space-y-2">
            {accounts.length === 0 && !loading && (
              <div className="text-center py-4 text-gray-500 text-sm">
                Chưa có account nào. Nhấn "Thêm" để dán cookie từ Extension.
              </div>
            )}

            {accounts.map(acc => {
              const selected = selectedAccounts.find(a => a.id === acc.id);
              const isSelected = !!selected;

              return (
                <div
                  key={acc.id}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isSelected ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-[#1a1a2a] border border-transparent hover:border-gray-700'
                    } ${acc.is_expired ? 'border-red-500/30' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleAccount(acc.id)}
                    disabled={acc.is_expired}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />

                  <span className={`w-2 h-2 rounded-full ${acc.is_expired ? 'bg-red-500' : acc.has_cookies ? 'bg-green-500' : 'bg-gray-500'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{acc.email || acc.id}</span>
                      {acc.is_expired && <span className="text-[10px] text-red-400">HẾT HẠN</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span className="text-green-400">{acc.has_cookies ? '🟢 Cookie OK' : '🔴 No cookie'}</span>
                      {acc.expires_in && <span className={acc.is_expired ? 'text-red-400' : 'text-yellow-400'}>⏰ {acc.expires_in}</span>}
                    </div>
                  </div>

                  {acc.projectLink ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(acc.projectLink!);
                          const btn = e.currentTarget;
                          const orig = btn.textContent;
                          btn.textContent = '✅ Copied!';
                          setTimeout(() => { btn.textContent = orig; }, 1500);
                        }}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 truncate max-w-[200px] cursor-pointer bg-transparent border-none p-0"
                        title={`Click để copy: ${acc.projectLink}`}
                      >🔗 {acc.projectLink.replace(/^https?:\/\//, '').substring(0, 35)}</button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (isRunning) return;
                          const raw = localStorage.getItem(STORAGE_KEY);
                          if (raw) {
                            const accs = JSON.parse(raw);
                            const updated = accs.map((a: any) => a.id === acc.id ? { ...a, projectLink: undefined } : a);
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                            loadAccounts();
                          }
                        }}
                        disabled={isRunning}
                        className={`w-5 h-5 rounded text-[10px] transition-colors flex items-center justify-center shrink-0 ${isRunning ? 'bg-gray-700 opacity-50 cursor-not-allowed' : 'bg-red-600/30 hover:bg-red-600 cursor-pointer'}`}
                        title={isRunning ? 'Đang chạy, không thể xóa' : 'Xóa dự án cũ'}
                      >✕</button>
                    </div>
                  ) : null}

                  {isSelected && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">Luồng:</span>
                      <select
                        value={selected.threads}
                        onChange={e => updateThreads(acc.id, parseInt(e.target.value))}
                        onClick={e => e.stopPropagation()}
                        className="px-1.5 py-0.5 bg-[#0a0a0f] border border-gray-700 rounded text-xs cursor-pointer focus:outline-none focus:border-cyan-500"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </div>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id); }}
                    className="w-7 h-7 bg-red-600/50 hover:bg-red-600 rounded text-xs transition-colors flex items-center justify-center shrink-0"
                    title="Xóa account"
                  >🗑️</button>

                </div>
              );
            })}

            {selectedAccounts.length > 0 && (
              <div className="pt-2 border-t border-gray-800 text-xs text-gray-400 text-center">
                Tổng: {selectedAccounts.length} account × {totalThreads} luồng song song
              </div>
            )}
          </div>
        )}
      </div>

      {
        showAddModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#12121a] rounded-xl w-full max-w-lg border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span>📋</span> Nhập Cookie từ Extension
                </h3>
                <button
                  onClick={() => { setShowAddModal(false); setCookieInput(''); }}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-5">
                <p className="text-xs text-gray-400 mb-3">Mở Extension → bấm Copy Cookie → dán vào đây:</p>
                <textarea
                  value={cookieInput}
                  onChange={e => setCookieInput(e.target.value)}
                  placeholder='Dán cookie JSON từ Extension vào đây...'
                  className="w-full h-40 px-3 py-2 bg-[#0a0a0f] border border-gray-700 rounded-lg text-sm text-white font-mono resize-none focus:outline-none focus:border-cyan-500 placeholder-gray-600"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => { setShowAddModal(false); setCookieInput(''); }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={saveAccount}
                    disabled={!cookieInput.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  >
                    💾 Lưu Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}
