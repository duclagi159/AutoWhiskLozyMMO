import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke, abortAllPending } from './bridge';
import { AccountSection, SelectedAccount } from './AccountSection';
import { TaskTable } from './TaskTable';
import { LogPanel } from './LogPanel';

const STORAGE_KEY = 'whisk-tasks';
const ACCOUNTS_KEY = 'whisk-selected-accounts';
const ORDER_KEY = 'whisk-order-counter';

export interface Task {
  id: string;
  order: number;
  selected: boolean;
  prompt: string;
  ratio: '16:9' | '9:16' | '1:1';
  count: number;
  status: 'pending' | 'queued' | 'generating' | 'done' | 'error';
  statusText?: string;
  results: string[];
  error?: string;
  accountId?: string;
  projectLink?: string;
}

export interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'step';
}

interface RefImage {
  id: string;
  url: string;
  name: string;
  mediaName?: string;
}

export default function App() {
  const [selectedAccounts, setSelectedAccounts] = useState<SelectedAccount[]>(() => {
    try {
      const saved = localStorage.getItem(ACCOUNTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [runningTaskIds, setRunningTaskIds] = useState<Set<string>>(new Set());
  const [accountEmails, setAccountEmails] = useState<Record<string, string>>({});
  const [refImages, setRefImages] = useState<RefImage[]>([]);
  const [saveFolder, setSaveFolder] = useState('');
  const [previewImage, setPreviewImage] = useState<{ url: string; taskOrder: number } | null>(null);
  const [showRefModal, setShowRefModal] = useState(false);
  const stopFlag = useRef(false);
  const orderCounter = useRef<number>((() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY);
      return saved ? parseInt(saved, 10) : 1;
    } catch { return 1; }
  })());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order), 0);
      if (maxOrder >= orderCounter.current) orderCounter.current = maxOrder + 1;
      localStorage.setItem(ORDER_KEY, String(orderCounter.current));
    } catch (e) { console.error('Failed to save tasks:', e); }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(selectedAccounts));
    } catch (e) { console.error('Failed to save accounts:', e); }
  }, [selectedAccounts]);

  // Folder picker helper using Tauri
  const pickFolder = async () => {
    try {
      const path = await invoke<string | null>('choose_folder');
      if (path) setSaveFolder(path);
    } catch { }
  };

  const globalSettingsRef = useRef({ ratio: '9:16' as '16:9' | '9:16' | '1:1', count: 2 });

  const log = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setLogs(prev => [...prev, { time, message, type }]);
  }, []);

  const addTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      order: orderCounter.current++,
      selected: false,
      prompt: '',
      ratio: globalSettingsRef.current.ratio,
      count: globalSettingsRef.current.count,
      status: 'pending',
      results: [],
    };
    localStorage.setItem(ORDER_KEY, String(orderCounter.current));
    setTasks(prev => [...prev, newTask]);
  };

  const addBulkTasks = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;
    const startOrder = orderCounter.current;
    const newTasks: Task[] = lines.map((prompt, i) => ({
      id: `task-${Date.now()}-${i}`,
      order: startOrder + i,
      selected: false,
      prompt,
      ratio: globalSettingsRef.current.ratio,
      count: globalSettingsRef.current.count,
      status: 'pending' as const,
      results: [],
    }));
    orderCounter.current = startOrder + lines.length;
    localStorage.setItem(ORDER_KEY, String(orderCounter.current));
    setTasks(prev => [...prev, ...newTasks]);
    log(`Added ${newTasks.length} tasks`, 'success');
    setBulkText('');
    setShowBulkModal(false);
  };

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const removeTask = (id: string) => {
    setTasks(prev => {
      const remaining = prev.filter(t => t.id !== id);
      const renumbered = remaining.map((t, idx) => ({ ...t, order: idx + 1 }));
      orderCounter.current = renumbered.length + 1;
      localStorage.setItem(ORDER_KEY, String(orderCounter.current));
      return renumbered;
    });
  };

  const resetTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' as const, statusText: undefined, error: undefined, selected: false } : t));
  };

  const toggleAll = (checked: boolean) => {
    setTasks(prev => prev.map(t => ({ ...t, selected: checked })));
  };

  const deleteSelected = () => {
    const selectedIds = tasks.filter(t => t.selected).map(t => t.id);
    if (selectedIds.length === 0) return;
    const remaining = tasks.filter(t => !t.selected);
    const renumbered = remaining.map((t, idx) => ({ ...t, order: idx + 1 }));
    setTasks(renumbered);
    orderCounter.current = renumbered.length + 1;
    localStorage.setItem(ORDER_KEY, String(orderCounter.current));
    log(`Deleted ${selectedIds.length} tasks`, 'info');
  };

  const processTask = async (task: Task, accountId: string): Promise<void> => {
    setRunningTaskIds(prev => new Set(prev).add(task.id));
    updateTask(task.id, { status: 'queued', statusText: 'Waiting...', accountId });

    try {
      // Look up account cookies from localStorage
      const ACCT_KEY = 'autowhisk_accounts';
      let accountCookies = '';
      let accountBearerToken = '';
      let accountHeaders: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(ACCT_KEY);
        if (raw) {
          const accounts = JSON.parse(raw);
          const acc = accounts.find((a: any) => a.id === accountId);
          if (acc?.cookies) accountCookies = acc.cookies;
          if (acc?.bearerToken) accountBearerToken = acc.bearerToken;
          if (acc?.headers) accountHeaders = acc.headers;
        }
      } catch { }

      if (!accountCookies && !accountBearerToken) {
        throw new Error('Account cookies not found');
      }

      log(`[Task #${task.order}] Generating - ${task.prompt.substring(0, 40)}... (${accountId.slice(-8)})`, 'step');
      updateTask(task.id, { status: 'generating', statusText: 'Generating...' });

      const latestTask = await new Promise<Task>(resolve => {
        setTasks(prev => { resolve(prev.find(t => t.id === task.id) || task); return prev; });
      });

      let existingWorkflowId: string | undefined;
      try {
        const raw = localStorage.getItem('autowhisk_accounts');
        if (raw) {
          const accs = JSON.parse(raw);
          const acc = accs.find((a: any) => a.id === accountId);
          if (acc?.projectLink) {
            const parts = acc.projectLink.split('/');
            existingWorkflowId = parts[parts.length - 1];
          }
        }
      } catch { }

      const result = await invoke<{ success: boolean; images?: { savedPath?: string; encodedImage?: string }[]; error?: string; projectLink?: string; diagInfo?: string }>('generate_image', {
        cookies: accountCookies || '',
        bearerToken: accountBearerToken || '',
        headers: accountHeaders,
        prompt: latestTask.prompt,
        aspectRatio: latestTask.ratio,
        count: latestTask.count,
        saveFolder: saveFolder || undefined,
        existingWorkflowId,
      });



      if (result.success && result.images?.length) {
        const paths = result.images
          .filter(img => img.savedPath || img.encodedImage)
          .map(img => img.savedPath || img.encodedImage || '');
        log(`[Task #${task.order}] ✅ Done ${paths.length}/${task.count} images`, 'success');

        if (result.projectLink) {

          try {
            const raw = localStorage.getItem('autowhisk_accounts');
            if (raw) {
              const accs = JSON.parse(raw);
              const currentAcc = accs.find((a: any) => a.id === accountId);
              if (currentAcc && !currentAcc.projectLink) {
                const updated = accs.map((a: any) => a.id === accountId ? { ...a, projectLink: result.projectLink } : a);
                localStorage.setItem('autowhisk_accounts', JSON.stringify(updated));
                window.dispatchEvent(new Event('accounts-updated'));
              }
            }
          } catch { }
        }

        updateTask(task.id, {
          status: 'done',
          statusText: `${paths.length} images`,
          results: paths,
          projectLink: result.projectLink || '',
          selected: false,
        });
      } else {
        log(`[Task #${task.order}] Error: ${result.error}`, 'error');
        updateTask(task.id, { status: 'error', statusText: result.error || 'Unknown error', error: result.error, selected: false });
      }
    } catch (e: unknown) {
      log(`[Task #${task.order}] Error: ${e}`, 'error');
      updateTask(task.id, { status: 'error', statusText: String(e), error: String(e), selected: false });
    } finally {
      setRunningTaskIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const runTasks = async (tasksToRun: Task[]) => {
    if (selectedAccounts.length === 0) { log('Chọn ít nhất 1 account!', 'error'); return; }
    const runnableStatuses = ['pending', 'done', 'error'];
    const validTasks = tasksToRun.filter(t => runnableStatuses.includes(t.status) && t.prompt.trim());
    if (validTasks.length === 0) { log('Không có task hợp lệ!', 'error'); return; }

    validTasks.forEach(t => {
      updateTask(t.id, { status: 'pending', statusText: undefined, results: [], error: undefined });
    });

    setIsRunning(true);
    stopFlag.current = false;
    const totalThreads = selectedAccounts.reduce((sum, a) => sum + a.threads, 0);
    log(`🚀 Chạy ${validTasks.length} tasks với ${selectedAccounts.length} accounts (${totalThreads} total threads)`, 'info');

    // Build thread pool
    const threadPool: { accountId: string; threadIdx: number }[] = [];
    for (const acc of selectedAccounts) {
      for (let i = 0; i < acc.threads; i++) {
        threadPool.push({ accountId: acc.id, threadIdx: i });
      }
    }

    log(`📋 Thread pool: ${threadPool.length} threads`, 'info');

    // Task queue
    const taskQueue = [...validTasks];
    const refUploadedAccounts = new Set<string>();

    // Worker function
    const worker = async (accountId: string, threadIdx: number): Promise<void> => {
      while (taskQueue.length > 0 && !stopFlag.current) {
        const task = taskQueue.shift();
        if (!task) break;

        if (refImages.length > 0 && !refUploadedAccounts.has(accountId)) {
          refUploadedAccounts.add(accountId);
          try {
            const ACCT_KEY = 'autowhisk_accounts';
            const raw = localStorage.getItem(ACCT_KEY);
            if (raw) {
              const accounts = JSON.parse(raw);
              const acc = accounts.find((a: any) => a.id === accountId);
              if (acc?.cookies) {
                let workflowId: string | undefined;
                if (acc.projectLink) {
                  const parts = acc.projectLink.split('/');
                  workflowId = parts[parts.length - 1];
                }
                const uploadResult = await invoke<{ success: boolean; uploadedCount?: number; workflowId?: string }>('upload_ref_images', {
                  cookies: acc.cookies,
                  refImages: refImages.map(r => r.url),
                  existingWorkflowId: workflowId,
                });
                if (uploadResult.success) {
                  log(`[${acc.email || accountId.slice(-8)}] 🖼️ Fill ${uploadResult.uploadedCount} ảnh tham chiếu thành công`, 'success');
                  if (uploadResult.workflowId && !acc.projectLink) {
                    const updated = accounts.map((a: any) => a.id === accountId ? { ...a, projectLink: `https://labs.google/fx/tools/whisk/project/${uploadResult.workflowId}` } : a);
                    localStorage.setItem(ACCT_KEY, JSON.stringify(updated));
                    window.dispatchEvent(new Event('accounts-updated'));
                  }
                } else {
                  log(`[${acc.email || accountId.slice(-8)}] ⚠️ Fill ảnh tham chiếu thất bại`, 'error');
                }
              }
            }
          } catch (err: any) {
            log(`[${accountId.slice(-8)}] ❌ Fill ref error: ${err.message || err}`, 'error');
          }
        }

        log(`[Thread ${accountId.slice(-8)}-${threadIdx}] Processing task #${task.order}`, 'step');
        await processTask(task, accountId);

        // Small delay between tasks on same thread
        await new Promise(r => setTimeout(r, 300));
      }
    };

    // Start all workers in parallel
    const workerPromises = threadPool.map(({ accountId, threadIdx }) =>
      worker(accountId, threadIdx)
    );

    await Promise.all(workerPromises);

    setIsRunning(false);
    if (stopFlag.current) {
      log('⏹️ Đã dừng!', 'info');
      stopFlag.current = false;
    } else {
      log('✅ Hoàn thành tất cả tasks!', 'success');
    }
  };

  const stopTasks = async () => {
    stopFlag.current = true;
    abortAllPending();
    // Mark all generating/queued tasks as stopped
    setTasks(prev => prev.map(t =>
      (t.status === 'generating' || t.status === 'queued')
        ? { ...t, status: 'error' as const, statusText: 'Đã dừng', error: 'Đã dừng', selected: false }
        : t
    ));
    setRunningTaskIds(new Set());
    setIsRunning(false);
    log('⏹️ Đã dừng tất cả!', 'info');
  };

  const getLatestTasks = (): Promise<Task[]> => new Promise(resolve => {
    setTasks(prev => { resolve([...prev]); return prev; });
  });

  const runSelected = async () => {
    const latest = await getLatestTasks();
    runTasks(latest.filter(t => t.selected));
  };
  const runAll = async () => {
    const latest = await getLatestTasks();
    runTasks(latest);
  };

  const downloadSelected = async () => {
    if (!saveFolder) { log('Bạn chưa chọn thư mục để tải!', 'error'); return; }
    const selectedDone = tasks.filter(t => t.selected && t.status === 'done' && t.results.length > 0);
    if (selectedDone.length === 0) { log('Không có ảnh để tải!', 'error'); return; }
    let count = 0;
    for (const task of selectedDone) {
      for (let i = 0; i < task.results.length; i++) {
        try {
          const link = document.createElement('a');
          link.href = task.results[i];
          link.download = `task-${task.order}-${i + 1}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          count++;
          await new Promise(r => setTimeout(r, 300));
        } catch { }
      }
    }
    log(`⬇️ Đã tải ${count} ảnh`, 'success');
  };

  const allImages = tasks.filter(t => t.status === 'done').flatMap(t =>
    (t.results || []).map((url, i) => ({ url, taskOrder: t.order, index: i }))
  );

  const selectedCount = tasks.filter(t => t.selected).length;
  const runnableCount = tasks.filter(t => t.selected && ['pending', 'done', 'error'].includes(t.status)).length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const totalThreads = selectedAccounts.reduce((sum, a) => sum + a.threads, 0);

  return (
    <div className="h-screen bg-[#0a0a0f] text-gray-200 flex flex-col overflow-hidden">
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur border-b border-gray-800 px-4 py-3 shrink-0">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
            <span className="text-2xl">🎨</span> AutoWhisk Batch Tool
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{tasks.length} tasks | {pendingCount} pending | {totalThreads} threads</span>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a2a] rounded-lg border border-gray-800">
              <span className="text-sm">📁</span>
              <button
                onClick={pickFolder}
                className="px-2 py-0.5 bg-[#12121a] border border-gray-700 hover:border-gray-500 rounded text-xs text-gray-400 hover:text-gray-200 transition-colors text-left truncate max-w-[200px]"
              >
                {saveFolder || 'Chọn thư mục...'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
        <div className="shrink-0">
          <AccountSection selectedAccounts={selectedAccounts} onSelectAccounts={setSelectedAccounts} onLog={log} onAccountsLoaded={setAccountEmails} isRunning={isRunning} />
        </div>

        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          <div className="flex-[2] bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden flex flex-col min-w-0">
            <TaskTable
              tasks={tasks}
              selectedCount={selectedCount}
              runnableCount={runnableCount}
              runningTaskIds={runningTaskIds}
              accountEmails={accountEmails}
              onAddTask={addTask}
              onShowBulkModal={() => setShowBulkModal(true)}
              onUpdateTask={updateTask}
              onRemoveTask={removeTask}
              onResetTask={resetTask}
              onToggleAll={toggleAll}
              onDeleteSelected={deleteSelected}
              onRunSelected={runSelected}
              onRunAll={runAll}
              onStop={stopTasks}
              isRunning={isRunning}
              onPreviewImage={(url: string, taskOrder: number) => setPreviewImage({ url, taskOrder })}
              onGlobalSettingsChange={(ratio, count) => { globalSettingsRef.current = { ratio, count }; }}
              onDownloadSelected={downloadSelected}
              onShowRefModal={() => setShowRefModal(true)}
              refImageCount={refImages.length}
            />
          </div>

          <div className="flex-1 flex flex-col gap-4 min-w-[300px] min-h-0 overflow-hidden">




            {/* Logs panel */}
            <div className="bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden flex flex-col shrink-0 max-h-[220px]">
              <LogPanel logs={logs} onClear={() => setLogs([])} />
            </div>

            {/* Image Gallery panel */}
            <div className="flex-1 bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden flex flex-col">
              <div className="px-3 py-2 bg-[#1a1a2a] border-b border-gray-800 shrink-0">
                <span className="text-xs text-gray-400">🖼️ Image ({allImages.length})</span>
              </div>
              <div className="flex-1 overflow-auto p-2">
                {allImages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-600 text-xs">Chưa có ảnh nào</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {allImages.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setPreviewImage({ url: img.url, taskOrder: img.taskOrder })}
                        className="aspect-square bg-gray-900 rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-cyan-500 transition-all group relative"
                      >
                        <img src={img.url} className="w-full h-full object-cover" alt={`Task #${img.taskOrder}`} />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-xs font-medium">Task #{img.taskOrder}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12121a] rounded-xl w-full max-w-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span>📝</span> Bulk Add Prompts
              </h3>
              <button
                onClick={() => { setShowBulkModal(false); setBulkText(''); }}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder="One prompt per line..."
                rows={12}
                className="w-full px-4 py-3 bg-[#1a1a2a] border border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 placeholder-gray-600"
                autoFocus
              />
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">
                  {bulkText.split('\n').filter(l => l.trim()).length} prompts
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowBulkModal(false); setBulkText(''); }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addBulkTasks}
                    disabled={bulkText.split('\n').filter(l => l.trim()).length === 0}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  >
                    Add {bulkText.split('\n').filter(l => l.trim()).length} tasks
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImage(null)}>
          <div className="bg-[#12121a] rounded-xl max-w-4xl w-full border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
              <span className="text-sm text-gray-300">🖼️ Image - Task #{previewImage.taskOrder}</span>
              <button onClick={() => setPreviewImage(null)} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-4">
              <img src={previewImage.url} alt={`Task #${previewImage.taskOrder}`} className="w-full rounded-lg max-h-[70vh] object-contain" />
              <div className="mt-3 flex gap-2">
                <a href={previewImage.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-xs font-medium transition-colors">
                  🔗 Open
                </a>
                <a href={previewImage.url} download={`image-task-${previewImage.taskOrder}.jpg`} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium transition-colors">
                  ⬇️ Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRefModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowRefModal(false)}>
          <div className="bg-[#12121a] rounded-xl w-full max-w-md border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                🖼️ Ảnh tham chiếu ({refImages.length}/3)
              </h3>
              <button
                onClick={() => setShowRefModal(false)}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <div className="flex gap-3 min-h-[100px] flex-wrap">
                {refImages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Chưa có ảnh tham chiếu</div>
                ) : (
                  refImages.map(img => (
                    <div key={img.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-700 shrink-0">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        onClick={async () => {
                          if (img.mediaName) {
                            try {
                              const raw = localStorage.getItem('autowhisk_accounts');
                              if (raw) {
                                const accs = JSON.parse(raw);
                                const acc = accs.find((a: any) => a.cookies);
                                if (acc?.cookies) {
                                  await invoke('delete_ref_image', { cookies: acc.cookies, mediaNames: [img.mediaName] });
                                }
                              }
                            } catch { }
                          }
                          setRefImages(prev => prev.filter(i => i.id !== img.id));
                        }}
                        className="absolute top-0 right-0 w-5 h-5 bg-red-600 rounded-bl text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >✕</button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex justify-between items-center">
                <label
                  className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors flex items-center gap-2"
                  style={{ backgroundColor: '#ffbd59', color: '#000' }}
                >
                  ➕ Chọn ảnh
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const remaining = 3 - refImages.length;
                      const toAdd = files.slice(0, remaining);
                      toAdd.forEach((file: File) => {
                        const reader = new FileReader();
                        reader.onload = (ev: ProgressEvent<FileReader>) => {
                          setRefImages(prev => {
                            if (prev.length >= 3) return prev;
                            return [...prev, { id: Date.now().toString() + Math.random(), url: ev.target?.result as string, name: file.name }];
                          });
                        };
                        reader.readAsDataURL(file);
                      });
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  onClick={() => setShowRefModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
