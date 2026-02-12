import { useState, useEffect } from 'react';
// import { invoke } from '@tauri-apps/api/core'; // Tauri invoke not available in WebView2
import { LogEntry, SelectedAccount } from './types';

interface AccountInfo {
  id: string;
  email: string;
  credits?: number;
  has_cookies: boolean;
  expires_in?: string;
  is_expired: boolean;
}

interface Props {
  selectedAccounts: SelectedAccount[];
  onSelectAccounts: (accounts: SelectedAccount[]) => void;
  onLog: (msg: string, type?: LogEntry['type']) => void;
  onAccountsLoaded: (emails: Record<string, string>) => void;
}

export function AccountSection({ selectedAccounts, onSelectAccounts, onLog, onAccountsLoaded }: Props) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const handler = (event: any) => {
      const message = event.data;
      if (message.type === 'accounts_list') {
        const list = message.data as AccountInfo[];
        setAccounts(list);
        const emailMap: Record<string, string> = {};
        for (const acc of list) {
          emailMap[acc.id] = acc.email || acc.id;
        }
        onAccountsLoaded(emailMap);
        setLoading(false);
        onLog(`✅ Loaded ${list.length} accounts`, 'success');
      } else if (message.type === 'account_added') {
        onLog(`✅ Account added: ${message.data.email}`, 'success');
        // accounts_list event will follow and update the list
      }
    };

    if ((window as any).chrome?.webview) {
      (window as any).chrome.webview.addEventListener('message', handler);
      loadAccounts(); // Initial load
    } else {
      // Dev mode fallback
      console.warn('WebView2 not detected');
    }

    return () => {
      if ((window as any).chrome?.webview) {
        (window as any).chrome.webview.removeEventListener('message', handler);
      }
    };
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    if ((window as any).chrome?.webview) {
      (window as any).chrome.webview.postMessage({ type: 'list_accounts' });
    } else {
      setLoading(false);
    }
  };

  const addAccount = async () => {
    onLog('🌐 Requesting add account...', 'step');
    if ((window as any).chrome?.webview) {
      (window as any).chrome.webview.postMessage({ type: 'add_account' });
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm(`Xóa account ${id}?`)) return;
    if ((window as any).chrome?.webview) {
      (window as any).chrome.webview.postMessage({ type: 'delete_account', id });
      // Optimistic update? No, wait for list.
    }
  };

  const refreshAccount = async (id: string) => {
    // Not implemented yet
    onLog('⚠️ Refresh not implemented in backend yet', 'info');
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
  }, []);

  const totalThreads = selectedAccounts.reduce((sum, a) => sum + a.threads, 0);

  return (
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
            onClick={(e) => { e.stopPropagation(); addAccount(); }}
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
              Chưa có account nào. Nhấn "Thêm" để đăng nhập.
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
                    <span className="text-green-400">{acc.credits ?? '--'} credits</span>
                    {acc.expires_in && <span className={acc.is_expired ? 'text-red-400' : 'text-yellow-400'}>⏰ {acc.expires_in}</span>}
                  </div>
                </div>

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
                      <option value={4}>4</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); refreshAccount(acc.id); }}
                  className={`px-2 py-1 rounded text-xs transition-colors ${acc.is_expired
                    ? 'bg-yellow-600 hover:bg-yellow-500 text-black font-bold animate-pulse'
                    : 'bg-blue-600/30 hover:bg-blue-600'
                    }`}
                  title={acc.is_expired ? "Đăng nhập lại để cập nhật cookie" : "Cập nhật cookie"}
                >
                  {acc.is_expired ? '🔑 Login' : '🔄'}
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id); }}
                  className="px-1.5 py-0.5 bg-red-600/30 hover:bg-red-600 rounded text-[10px] transition-colors"
                >
                  🗑️
                </button>
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
  );
}
