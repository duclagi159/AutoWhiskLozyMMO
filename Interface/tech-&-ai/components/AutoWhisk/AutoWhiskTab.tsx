import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AccountSection } from './AccountSection';
import { TaskTable } from './TaskTable';
import { LogPanel } from './LogPanel';
import { VideoGallery } from './VideoGallery';
import type { Task, LogEntry, SelectedAccount, VideoOperation } from './types';

// Mock invoke for now
const invoke = async <T,>(cmd: string, args?: any): Promise<T> => {
  console.log(`[Mock Invoke] ${cmd}`, args);
  await new Promise(r => setTimeout(r, 500));

  if (cmd === 'check_video_status') {
    return { operations: args.operations, remaining_credits: 100 } as any;
  }
  if (cmd === 'generate_video') {
    return {
      success: true,
      operations: [{
        operation_name: 'mock-op',
        scene_id: 'mock-scene-' + Date.now(),
        status: 'MEDIA_GENERATION_STATUS_PENDING'
      }]
    } as any;
  }
  if (cmd === 'check_gpm') return { success: true } as any;
  if (cmd === 'list_accounts') return [] as any; // Handled in AccountSection

  return {} as any;
};

const STORAGE_KEY = 'veo3-tasks';
const ACCOUNTS_KEY = 'veo3-selected-accounts';
const ORDER_KEY = 'veo3-order-counter';

const AutoWhiskTab: React.FC = () => {
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
  const [previewVideo, setPreviewVideo] = useState<{ url: string; taskOrder: number } | null>(null);
  const [accountEmails, setAccountEmails] = useState<Record<string, string>>({});
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
      type: 'text-to-video',
      ratio: '16:9',
      count: 2,
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
      type: 'text-to-video' as const,
      ratio: '16:9' as const,
      count: 2,
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

  const fillBulkImages = async (type: 'start' | 'end') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      const pendingTasks = tasks.filter(t => t.status === 'pending');
      let filled = 0;
      for (let i = 0; i < Math.min(files.length, pendingTasks.length); i++) {
        const file = files[i];
        const task = pendingTasks[i];
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, [type === 'start' ? 'startImage' : 'endImage']: base64 } : t
          ));
        };
        reader.readAsDataURL(file);
        filled++;
      }
      log(`Filled ${filled} ${type} images`, 'success');
    };
    input.click();
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
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' as const, statusText: undefined, results: [], operations: undefined, error: undefined, selected: false, accountId: undefined } : t));
    log(`Reset task`, 'info');
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

  const pollTaskStatus = async (task: Task, accountId: string): Promise<void> => {
    const POLL_INTERVAL = 2000; // Faster mock polling
    const MAX_POLLS = 10;
    let currentOps = task.operations || [];

    for (let pollCount = 1; pollCount <= MAX_POLLS; pollCount++) {
      if (stopFlag.current) {
        log(`[Task #${task.order}] Stopped by user`, 'info');
        updateTask(task.id, { status: 'error', statusText: 'Stopped', operations: currentOps, selected: false });
        return;
      }

      // Mock completion
      if (pollCount > 3) {
        log(`[Task #${task.order}] Done (Mock)`, 'success');
        updateTask(task.id, { status: 'done', statusText: `Mock Done`, results: ['https://www.w3schools.com/html/mov_bbb.mp4'], operations: currentOps, selected: false });
        return;
      }

      log(`[Task #${task.order}] Polling (${pollCount})`, 'step');
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  };

  const processTask = async (task: Task, accountId: string): Promise<VideoOperation[] | null> => {
    setRunningTaskIds(prev => new Set(prev).add(task.id));
    updateTask(task.id, { status: 'queued', statusText: 'Waiting...', accountId });

    try {
      const isI2V = !!(task.startImage || task.endImage);
      const videoType = isI2V ? 'image-to-video' : 'text-to-video';
      log(`[Task #${task.order}] ${videoType === 'image-to-video' ? 'I2V' : 'T2V'} - ${task.prompt.substring(0, 40)}... (${accountId.slice(-8)})`, 'step');

      if (isI2V) {
        updateTask(task.id, { status: 'uploading', statusText: 'Uploading...' });
      } else {
        updateTask(task.id, { status: 'getting-token', statusText: 'Getting token...' });
      }

      // Mock delay
      await new Promise(r => setTimeout(r, 1000));

      const result = await invoke<{ success: boolean; operations?: VideoOperation[]; error?: string }>('generate_video', {
        accountId,
        request: {
          prompt: task.prompt,
          video_type: videoType,
        },
      });

      if (result.success && result.operations?.length) {
        const opCount = result.operations.length;
        log(`[Task #${task.order}] Sent ${opCount} requests → PENDING`, 'success');
        updateTask(task.id, { status: 'polling', statusText: `Processing ${opCount}...`, operations: result.operations });
        return result.operations;
      } else {
        return null;
      }
    } catch (e: unknown) {
      log(`[Task #${task.order}] Error: ${e}`, 'error');
      return null;
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
      updateTask(t.id, { status: 'pending', statusText: undefined, results: [], operations: undefined, error: undefined });
    });

    setIsRunning(true);
    stopFlag.current = false;
    log(`🚀 Chạy ${validTasks.length} tasks (Mock Mode)`, 'info');

    // Simple sequential execution for mock
    for (const task of validTasks) {
      if (stopFlag.current) break;
      const acc = selectedAccounts[0]; // Just use first account
      const ops = await processTask(task, acc.id);
      if (ops) {
        await pollTaskStatus({ ...task, operations: ops }, acc.id);
      }
    }

    setIsRunning(false);
    log('✅ Hoàn thành (Mock)', 'success');
  };

  const stopTasks = async () => {
    stopFlag.current = true;
    log('⏹️ Đang dừng...', 'info');
  };

  const runSelected = () => runTasks(tasks.filter(t => t.selected));
  const runAll = () => runTasks(tasks);

  const handlePreviewVideo = (url: string, taskOrder: number) => {
    setPreviewVideo({ url, taskOrder });
  };

  const allVideos = tasks.flatMap(t =>
    (t.results || []).map((url, i) => ({ url, taskOrder: t.order, index: i }))
  );

  const selectedCount = tasks.filter(t => t.selected).length;
  const runnableCount = tasks.filter(t => t.selected && ['pending', 'done', 'error'].includes(t.status)).length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const totalThreads = selectedAccounts.reduce((sum, a) => sum + a.threads, 0);

  return (
    <div className="h-full bg-[#0a0a0f] text-gray-200 flex flex-col">
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur border-b border-gray-800 px-4 py-3 shrink-0">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
            <span className="text-2xl">🎬</span> AutoWhisk Batch Tool
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{tasks.length} tasks | {pendingCount} pending | {totalThreads} threads</span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
        <div className="shrink-0">
          <AccountSection selectedAccounts={selectedAccounts} onSelectAccounts={setSelectedAccounts} onLog={log} onAccountsLoaded={setAccountEmails} />
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          <div className="flex-[2] bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden flex flex-col min-w-0">
            <TaskTable
              tasks={tasks}
              selectedCount={selectedCount}
              runnableCount={runnableCount}
              runningTaskIds={runningTaskIds}
              accountEmails={accountEmails}
              onAddTask={addTask}
              onShowBulkModal={() => setShowBulkModal(true)}
              onFillBulkImages={fillBulkImages}
              onUpdateTask={updateTask}
              onRemoveTask={removeTask}
              onResetTask={resetTask}
              onToggleAll={toggleAll}
              onDeleteSelected={deleteSelected}
              onRunSelected={runSelected}
              onRunAll={runAll}
              onStop={stopTasks}
              isRunning={isRunning}
              onPreviewVideo={handlePreviewVideo}
            />
          </div>

          <div className="flex-1 flex flex-col gap-4 min-w-[300px]">
            <div className="flex-1 bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden flex flex-col min-h-[200px]">
              <VideoGallery videos={allVideos} onPreviewVideo={handlePreviewVideo} />
            </div>

            <div className="flex-1 bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden flex flex-col min-h-[200px]">
              <LogPanel logs={logs} onClear={() => setLogs([])} />
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

      {previewVideo && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setPreviewVideo(null)}>
          <div className="bg-[#12121a] rounded-xl max-w-4xl w-full border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
              <span className="text-sm text-gray-300">🎬 Video - Task #{previewVideo.taskOrder}</span>
              <button onClick={() => setPreviewVideo(null)} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-4">
              <video src={previewVideo.url} controls autoPlay className="w-full rounded-lg max-h-[70vh]" />
              <div className="mt-3 flex gap-2">
                <a href={previewVideo.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-xs font-medium transition-colors">
                  🔗 Open
                </a>
                <a href={previewVideo.url} download={`video-task-${previewVideo.taskOrder}.mp4`} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium transition-colors">
                  ⬇️ Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoWhiskTab;